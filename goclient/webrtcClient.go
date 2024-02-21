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

		canditate := Candidate{
			MType:     "candidate",
			Candidate: c.ToJSON(),
			ClientId:  offer.ClientId,
		}

		outbound, marshalErr := json.Marshal(canditate)
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

func Signal() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Hour)
	defer cancel()

	url := "https://important-eel-61.deno.dev/"
	iceServers, err := FetchICE(url)
	if err != nil {
		panic(err)
	}
	log.Println(iceServers)

	// baseDomain := "d1syxz7xf05rvd.cloudfront.net/"
	baseDomain := "localhost:8080"

	signalingServer := fmt.Sprintf("ws://%s?role=server", baseDomain)
	signalingDomain := fmt.Sprintf("http://%s", baseDomain)
	log.Println(signalingDomain, signalingServer)

	ws, _, err := websocket.Dial(ctx, signalingServer, nil)
	if err != nil {
		panic(err)
	}
	defer ws.Close(websocket.StatusNormalClosure, "the client is closing")

	// clients := make(map[string]*webrtc.PeerConnection)

	go func() {
		for {
			time.Sleep(10 * time.Second)

			// Read message
			var baseMsg map[string]interface{}
			err := wsjson.Read(ctx, ws, baseMsg)
			if err != nil {
				log.Printf("error reading message: %v", err)
				continue // or break/return depending on your error handling
			}

			fmt.Println(baseMsg)

			/*
				switch baseMsg["MType"] {
				case "idAssgn":

					log.Printf("Id: %s", baseMsg["id"])

				case "offer":
					offer := Offer{
						MTtype: baseMsg["mtype"],
					}

					clients[offer.ClientId] = createNewPeer(offer, ws, &iceServers)

				case "candidate":
					var candidate Candidate
					if err := json.Unmarshal([]byte(baseMsg), &candidate); err != nil {
						log.Fatal(err)
					}

					if err = clients[candidate.ClientId].AddICECandidate(candidate.Candidate); err != nil {
						panic(err)
					}
				default:
					log.Printf("unknown message type: %s", baseMsg.MType)
				}
			*/
		}
	}()
}
