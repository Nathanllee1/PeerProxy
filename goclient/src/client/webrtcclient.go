package main

import (
	"context"
	"encoding/json"
	"fmt"
	"goClient/src/common"
	"log"

	"github.com/pion/webrtc/v4"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

type BaseMessage struct {
	MType string `json:"mtype"`
}

type Candidate struct {
	MType     string                  `json:"mtype"`
	Candidate webrtc.ICECandidateInit `json:"candidate"`
	ClientId  string                  `json:"clientId"`
	Id        string                  `json:"id"` // Receiver's Id (server's Id)
}

type Offer struct {
	MType    string                    `json:"mtype"`
	Offer    webrtc.SessionDescription `json:"offer"`
	ClientId string                    `json:"clientId"`
	Id       string                    `json:"id"` // Receiver's Id (server's Id)
}

type Answer struct {
	MType    string                    `json:"mtype"`
	Answer   webrtc.SessionDescription `json:"answer"`
	ClientId string                    `json:"clientId"`
}

type IdAssignment struct {
	MType string `json:"mtype"`
	Id    string `json:"id"`
}

func Signal(serverId string) {
	// Fetch ICE servers
	iceServers, err := common.FetchICE("https://important-eel-61.deno.dev/")
	if err != nil {
		panic(err)
	}

	// Create a new PeerConnection
	peerConnection, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: iceServers,
	})
	if err != nil {
		panic(err)
	}

	// Create a DataChannel
	dataChannel, err = peerConnection.CreateDataChannel("data", nil)
	if err != nil {
		panic(err)
	}

	// Set up handlers for DataChannel events
	dataChannel.OnOpen(func() {
		fmt.Println("Data channel opened")

		close(dataChannelReady)
	})

	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		// Handle incoming messages
		go HandleDataChannelMessage(msg)
	})

	// Connect to the signaling server
	url := "wss://peepsignal.fly.dev/?role=client"

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ws, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		panic(err)
	}
	defer ws.Close(websocket.StatusNormalClosure, "")

	var clientId string

	// Create a channel to wait until we get assigned an ID
	idAssigned := make(chan struct{})

	// Start reading messages from the signaling server
	go func() {
		for {
			var msg json.RawMessage
			err := wsjson.Read(ctx, ws, &msg)
			if err != nil {
				log.Println("Error reading from signaling server:", err)
				close(idAssigned)
				return
			}

			var baseMsg BaseMessage
			err = json.Unmarshal(msg, &baseMsg)
			if err != nil {
				log.Println("Error unmarshalling base message:", err)
				continue
			}

			switch baseMsg.MType {
			case "idAssgn":
				var idAsgn IdAssignment
				err = json.Unmarshal(msg, &idAsgn)
				if err != nil {
					log.Println("Error unmarshalling idAssgn message:", err)
					continue
				}
				clientId = idAsgn.Id
				fmt.Println("Assigned Client ID:", clientId)
				close(idAssigned) // Signal that we have received the ID
			case "answer":
				var answerMessage Answer
				err = json.Unmarshal(msg, &answerMessage)
				if err != nil {
					log.Println("Error unmarshalling answer message:", err)
					continue
				}
				err = peerConnection.SetRemoteDescription(answerMessage.Answer)
				if err != nil {
					log.Println("Error setting remote description:", err)
					continue
				}
			case "candidate":
				var candidateMsg Candidate
				err = json.Unmarshal(msg, &candidateMsg)
				if err != nil {
					log.Println("Error unmarshalling candidate message:", err)
					continue
				}

				err = peerConnection.AddICECandidate(candidateMsg.Candidate)
				if err != nil {
					log.Println("Error adding ICE candidate:", err)
				}
			case "heartbeat":
				// Handle heartbeat if necessary
			default:
				log.Println("Unknown message type:", baseMsg.MType)
			}
		}
	}()

	// Wait until we have received the ClientId
	<-idAssigned

	// Now that we have the ClientId, create an offer
	offer, err := peerConnection.CreateOffer(nil)
	if err != nil {
		panic(err)
	}

	// Set local description
	err = peerConnection.SetLocalDescription(offer)
	if err != nil {
		panic(err)
	}

	// Send the offer to the server via the signaling server
	offerMessage := Offer{
		MType:    "offer",
		Offer:    offer,
		ClientId: clientId, // Use assigned ClientId (sender's ID)
		Id:       serverId, // Receiver's Id (server's ID)
	}

	err = wsjson.Write(ctx, ws, offerMessage)
	if err != nil {
		panic(err)
	}

	// Handle ICE candidates
	peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate == nil {
			return
		}
		candidateMsg := Candidate{
			MType:     "candidate",
			Candidate: candidate.ToJSON(),
			ClientId:  clientId, // Sender's ClientId
			Id:        serverId, // Receiver's Id (server's Id)
		}
		// Send candidate to the server via signaling server
		if err := wsjson.Write(ctx, ws, candidateMsg); err != nil {
			log.Println("Error sending ICE candidate:", err)
		}
	})

	// Keep the main function running
	select {}
}
