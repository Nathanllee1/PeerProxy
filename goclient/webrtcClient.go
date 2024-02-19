package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/pion/webrtc/v4"
	"golang.org/x/net/websocket"
)

type BaseMesage struct {
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

func createNewPeer(offer Offer, ws *websocket.Conn, iceServers *[]webrtc.ICEServer) *webrtc.PeerConnection {
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

		if _, err = ws.Write(outbound); err != nil {
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

	if _, err = ws.Write(outbound); err != nil {
		panic(err)
	}

	return peerConnection

}

func Signal() {
	url := "https://important-eel-61.deno.dev/"
	iceServers, err := FetchICE(url)

	if err != nil {
		panic(err)
	}

	log.Println(iceServers)

	signalingSever := "wss://d1syxz7xf05rvd.cloudfront.net/?role=server&id=foo"
	signalingDomain := "https://d1syxz7xf05rvd.cloudfront.net/"

	// signalingSever := "ws://localhost:8080?role=server"
	// signalingDomain := "http://localhost:8080"

	ws, err := websocket.Dial(signalingSever, "", signalingDomain)
	if err != nil {
		panic(err)
	}

	defer ws.Close()

	clients := make(map[string]*webrtc.PeerConnection)

	go func() {
		for {
			var response = make([]byte, 2048)
			n, err := ws.Read(response)

			var baseMsg BaseMesage

			fmt.Println(n)
			if err := json.Unmarshal(response[:n], &baseMsg); err != nil {
				panic(err)
			}

			switch baseMsg.MType {
			case "idAssgn":
				var idAssgn IdAssignment
				if err := json.Unmarshal(response[:n], &idAssgn); err != nil {
					log.Fatal(err)
				}
				log.Printf("Id: %s", idAssgn.Id)

			case "offer":
				var offer Offer
				if err := json.Unmarshal(response[:n], &offer); err != nil {
					log.Fatal(err)
				}

				clients[offer.ClientId] = createNewPeer(offer, ws, &iceServers)

			case "candidate":
				var canidate Candidate
				if err := json.Unmarshal(response[:n], &canidate); err != nil {
					log.Fatal(err)
				}

				if err = clients[canidate.ClientId].AddICECandidate(canidate.Candidate); err != nil {
					panic(err)
				}
			default:
				log.Printf("unknown message type: %s", string(response[:n]))

			}

		}
	}()
}
