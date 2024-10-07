package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"goClient/src/common"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

var (
	dataChannel      *webrtc.DataChannel // Assume this is set up in webrtcClient.go
	dataChannelReady = make(chan struct{})
	streamIDMu       sync.Mutex
	currentID        uint32 = 1
)

func generateStreamID() uint32 {
	streamIDMu.Lock()
	defer streamIDMu.Unlock()
	id := currentID
	currentID++
	return id
}

func ProxyHTTPRequest(w http.ResponseWriter, r *http.Request) {
	<-dataChannelReady

	streamID := generateStreamID()
	fmt.Println("\nProxying request with StreamIdentifier:", streamID, "URL:", r.URL)

	// Serialize request headers
	headers := make(map[string]string)
	headers["method"] = r.Method
	headers["url"] = r.URL.String()

	for name, values := range r.Header {
		headers[name] = values[0] // Simplification; handle multiple values if needed
	}

	headersJSON, err := json.Marshal(headers)
	if err != nil {
		fmt.Println("Error marshalling headers:", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Create header packet
	headerPacket := common.Packet{
		StreamIdentifier: streamID,
		PacketNum:        0,
		PayloadLength:    uint16(len(headersJSON)),
		IsHeader:         true,
		IsFinalMessage:   true,
		Payload:          headersJSON,
	}

	// Send header packet over DataChannel
	err = dataChannel.Send(headerPacket.Serialize())
	if err != nil {
		fmt.Println("Error sending header packet:", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Send request body if exists
	if r.ContentLength > 0 {
		sendRequestBody(r.Body, streamID)
	} else {
		// Send final packet indicating end of request body
		finalPacket := common.Packet{
			StreamIdentifier: streamID,
			PacketNum:        1,
			PayloadLength:    0,
			IsHeader:         false,
			IsFinalMessage:   true,
			Payload:          []byte{},
		}
		dataChannel.Send(finalPacket.Serialize())
	}

	// Prepare to receive response
	packetStream := NewPacketStream(30 * time.Second)
	RequestManager.AddStream(streamID, packetStream)

	// Read response headers
	headersData, err := packetStream.ReadNextPacket()
	if err != nil {
		fmt.Println("Error reading response headers:", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	// fmt.Println("Got response headers:", string(headersData))

	// Parse response headers
	var respHeaders http.Header
	err = json.Unmarshal(headersData, &respHeaders)
	if err != nil {
		fmt.Println(respHeaders)
		fmt.Println("Error parsing response headers:", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Set response headers and status code
	for name, values := range respHeaders {
		for _, value := range values {
			w.Header().Add(name, value)
		}
	}

	statusCodeStr := respHeaders.Get("status_code")
	if statusCodeStr != "" {
		statusCode, err := strconv.Atoi(statusCodeStr)
		if err == nil {
			w.WriteHeader(statusCode)
		}
	}

	// Read response body and write to ResponseWriter
	_, err = io.Copy(w, packetStream)
	if err != nil {
		fmt.Println("Error copying response body:", err)
		return
	}

	// Remove the stream from the RequestManager
	RequestManager.RemoveStream(streamID)
}

func HandleDataChannelMessage(msg webrtc.DataChannelMessage) {
	reader := bytes.NewReader(msg.Data)
	packet, err := common.ParsePacket(reader)
	if err != nil {
		fmt.Println("Error parsing packet:", err)
		return
	}

	/*
		fmt.Printf("Received packet: StreamIdentifier=%d, PacketNum=%d, IsHeader=%v, IsFinalMessage=%v, PayloadLength=%v\n",
			packet.StreamIdentifier, packet.PacketNum, packet.IsHeader, packet.IsFinalMessage, packet.PayloadLength)
	*/

	packetStream, exists := RequestManager.GetStream(packet.StreamIdentifier)
	if !exists {
		fmt.Println("Unknown StreamIdentifier:", packet.StreamIdentifier)
		return
	}

	// Add packet to PacketStream
	packetStream.AddPacket(packet)
}

func sendRequestBody(body io.ReadCloser, streamID uint32) {
	defer body.Close()
	const payloadSize = 65535 - 11
	buffer := make([]byte, payloadSize)
	packetNum := uint32(1)

	for {
		n, err := body.Read(buffer)
		if n > 0 {
			payload := buffer[:n]
			bodyPacket := common.Packet{
				StreamIdentifier: streamID,
				PacketNum:        packetNum,
				PayloadLength:    uint16(len(payload)),
				IsHeader:         false,
				IsFinalMessage:   false,
				Payload:          payload,
			}
			errSend := dataChannel.Send(bodyPacket.Serialize())
			if errSend != nil {
				fmt.Println("Error sending body packet:", errSend)
				return
			}
			packetNum++
		}

		if err != nil {
			if err == io.EOF {
				// Send final packet indicating end of body
				finalPacket := common.Packet{
					StreamIdentifier: streamID,
					PacketNum:        packetNum,
					PayloadLength:    0,
					IsHeader:         false,
					IsFinalMessage:   true,
					Payload:          []byte{},
				}
				errSend := dataChannel.Send(finalPacket.Serialize())
				if errSend != nil {
					fmt.Println("Error sending final packet:", errSend)
				}
				break
			} else {
				fmt.Println("Error reading request body:", err)
				return
			}
		}
	}
}
