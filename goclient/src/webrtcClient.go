package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/pion/webrtc/v4"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

type BaseMessage struct {
	MType string `json:"mtype"`
}

type IdAssignment struct {
	MType string `json:"mtype"`
	Id    string `json:"id"`
}

type Candidate struct {
	MType     string                  `json:"mtype"`
	Candidate webrtc.ICECandidateInit `json:"candidate"`
	ClientId  string                  `json:"clientId"`
}

type Offer struct {
	MTtype   string                    `json:"mtype"`
	Offer    webrtc.SessionDescription `json:"offer"`
	ClientId string                    `json:"clientId"`
}

type Answer struct {
	MTtype   string                    `json:"mtype"`
	Answer   webrtc.SessionDescription `json:"answer"`
	ClientId string                    `json:"clientId"`
}

func createNewPeer(offer Offer, ws *websocket.Conn, iceServers *[]webrtc.ICEServer, ctx context.Context) *webrtc.PeerConnection {
	peerConnection, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers: *iceServers,
	})
	if err != nil {
		panic(err)
	}

	peerConnection.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}

		candidate := Candidate{
			MType:     "candidate",
			Candidate: c.ToJSON(),
			ClientId:  offer.ClientId,
		}

		fmt.Println(candidate)

		outbound, marshalErr := json.Marshal(candidate)
		if marshalErr != nil {
			panic(marshalErr)
		}

		if err = ws.Write(ctx, websocket.MessageText, outbound); err != nil {
			panic(err)
		}
	})

	peerConnection.OnICEConnectionStateChange(func(connectionState webrtc.ICEConnectionState) {
		fmt.Printf("ICE Connection State has changed: %s\n", connectionState.String())
	})

	// Send the current time via a DataChannel to the remote peer every 3 seconds
	peerConnection.OnDataChannel(func(d *webrtc.DataChannel) {
		d.OnOpen(func() {
			for range time.Tick(time.Second * 3) {
				if err = d.SendText(time.Now().String()); err != nil {
					fmt.Println(err)
				}
			}
		})

		defer d.Close()
	})

	if err = peerConnection.SetRemoteDescription(offer.Offer); err != nil {
		panic(err)
	}

	answer, answerErr := peerConnection.CreateAnswer(nil)
	if answerErr != nil {
		panic(answerErr)
	}

	if err = peerConnection.SetLocalDescription(answer); err != nil {
		panic(err)
	}

	answerRet := Answer{
		MTtype:   "answer",
		Answer:   answer,
		ClientId: offer.ClientId,
	}

	outbound, marshalErr := json.Marshal(answerRet)
	if marshalErr != nil {
		panic(marshalErr)
	}

	if err = ws.Write(ctx, websocket.MessageText, outbound); err != nil {
		panic(err)
	}

	return peerConnection

}

func ws(clients map[string]*webrtc.PeerConnection, iceServers *[]webrtc.ICEServer) {
	// Specify the WebSocket server URL
	// url := "ws://localhost:8080/?role=server"
	url := "wss://d1syxz7xf05rvd.cloudfront.net/?role=server"

	// Create a context with a timeout for the connection
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to the WebSocket server
	c, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		log.Fatal("error connecting to WebSocket server:", err)
	}
	defer c.Close(websocket.StatusInternalError, "the client crashed")

	// Set the connection to receive messages
	for {
		// Create a variable to store the received message
		var rawMsg json.RawMessage

		// Read message using wsjson
		err := wsjson.Read(ctx, c, &rawMsg)
		if err != nil {
			log.Fatal("error reading message:", err)
		}

		// Print the received message
		// fmt.Printf("Received: %v\n", rawMsg)

		var baseMsg BaseMessage
		json.Unmarshal(rawMsg, &baseMsg)

		switch baseMsg.MType {
		case "idAssgn":

			var idAsgn IdAssignment
			json.Unmarshal(rawMsg, &idAsgn)

			log.Printf("Id: %s", idAsgn.Id)

		case "offer":

			var offer Offer
			json.Unmarshal(rawMsg, &offer)

			clients[offer.ClientId] = createNewPeer(offer, c, iceServers, ctx)

		case "candidate":
			var candidate Candidate
			if err := json.Unmarshal(rawMsg, &candidate); err != nil {
				log.Fatal(err)
			}

			fmt.Println("Received candidate", candidate)

			if err = clients[candidate.ClientId].AddICECandidate(candidate.Candidate); err != nil {
				panic(err)
			}
		default:
			log.Printf("unknown message type: %s", baseMsg.MType)
		}

	}

}

func Signal() {
	// ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	// defer cancel()

	url := "https://important-eel-61.deno.dev/"
	iceServers, err := FetchICE(url)
	if err != nil {
		panic(err)
	}
	log.Println(iceServers)

	clients := make(map[string]*webrtc.PeerConnection)
	ws(clients, &iceServers)

}
