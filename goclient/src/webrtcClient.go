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

func createNewPeer(offer Offer, ws *websocket.Conn, iceServers *[]webrtc.ICEServer, ctx context.Context, clients Clients, clientId string) *webrtc.PeerConnection {
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

		//fmt.Println(candidate)

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

		if connectionState == webrtc.ICEConnectionStateClosed {
			delete(clients, clientId)
		}
	})
	/*
		var id uint16 = 0
		var ordered bool = false
		var negotiated bool = false
		d, err := peerConnection.CreateDataChannel("data", &webrtc.DataChannelInit{
			ID:         &id,
			Ordered:    &ordered,
			Negotiated: &negotiated,
		})

		d.OnOpen(func() {
			fmt.Println("Data channel opened")

		})

		d.OnMessage(func(message webrtc.DataChannelMessage) {
			// fmt.Printf("Message from DataChannel '%s': '%s'\n", d.Label(), string(message.Data))
			fmt.Println(message.Data)
			go ProxyDCMessage(message, clientId, d)

		})

		defer d.Close()
	*/

	// Send the current time via a DataChannel to the remote peer every 3 seconds
	peerConnection.OnDataChannel(func(d *webrtc.DataChannel) {
		d.OnOpen(func() {
			fmt.Println("Data channel opened")

		})

		d.OnMessage(func(message webrtc.DataChannelMessage) {
			// fmt.Printf("Message from DataChannel '%s': '%s'\n", d.Label(), string(message.Data))

			go ProxyDCMessage(message, clientId, d)

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

func readWSMessages(clients Clients, iceServers *[]webrtc.ICEServer, connection *websocket.Conn, ctx context.Context) {

	candidates := make(map[string][]webrtc.ICECandidateInit)

	// Set the connection to receive messages
	for {
		// Create a variable to store the received message
		var rawMsg json.RawMessage

		// Read message using wsjson
		err := wsjson.Read(ctx, connection, &rawMsg)
		if err != nil {
			fmt.Println("error reading message:", err)
			return
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

			clients[offer.ClientId] = createNewPeer(offer, connection, iceServers, ctx, clients, offer.ClientId)

			for candidate := range candidates[offer.ClientId] {
				clients[offer.ClientId].AddICECandidate(candidates[offer.ClientId][candidate])
			}

		case "candidate":
			var candidate Candidate
			if err := json.Unmarshal(rawMsg, &candidate); err != nil {
				log.Fatal(err)
			}

			// fmt.Println("Received candidate", candidate)
			client, ok := clients[candidate.ClientId]

			if !ok {
				candidates[candidate.ClientId] = append(candidates[candidate.ClientId], candidate.Candidate)
				break
			}

			err := client.AddICECandidate(candidate.Candidate)

			if err != nil {
				fmt.Println("Could not add ice candidate", err)
			}

		case "heartbeat":

		default:
			log.Printf("unknown message type: %s", baseMsg.MType)
		}

	}

}

func retryWS(clients Clients, iceServers *[]webrtc.ICEServer) {
	// keeps trying to reconnect to the websocket server with an exponential backoff
	// Specify the WebSocket server URL
	// url := "ws://localhost:8080/?role=server"
	// url := "wss://d1syxz7xf05rvd.cloudfront.net/?role=server"
	// url := "wss://nathanlee.ngrok.io/?role=server"
	url := "wss://peepsignal.fly.dev/?role=server&id=" + ServerId

	// Create a context with a timeout for the connection
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Add logic to retry connection on disconnect with exponential backoff
	fmt.Println("View page at https://" + ServerId + ".peerproxy.dev")

	// Connect to the WebSocket server
	for {
		connection, _, err := websocket.Dial(ctx, url, nil)
		if err == nil {
			readWSMessages(clients, iceServers, connection, ctx)
			connection.Close(websocket.StatusInternalError, "the client crashed")

		}

		log.Print("error connecting to WebSocket server:", err)

		time.Sleep(2 * time.Second)
		fmt.Println("Retrying")
	}

}

type Clients map[string]*webrtc.PeerConnection

func Signal() {
	iceUrl := "https://important-eel-61.deno.dev/"
	iceServers, err := FetchICE(iceUrl)
	if err != nil {
		panic(err)
	}
	// log.Println(iceServers)

	clients := make(Clients)
	retryWS(clients, &iceServers)
	fmt.Println("Post ws")
}
