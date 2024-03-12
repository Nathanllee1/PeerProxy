package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/pion/webrtc/v4"
)

type PacketStream struct {
	dataChannel       chan Packet
	buffer            []byte
	done              bool
	nextSequence      int
	outOfOrderPackets map[int][]byte
	lastPacketNum     uint32
	lastPacketFound   bool
	packetsIngested   int
}

func (r *PacketStream) Read(p []byte) (int, error) {

	if r.done && len(r.buffer) == 0 && len(r.outOfOrderPackets) == 0 {
		fmt.Println("Done reading")
		return 0, io.EOF
	}

	for len(r.buffer) == 0 && !r.done {
		select {
		case packet, ok := <-r.dataChannel:

			r.packetsIngested++

			if !ok {
				r.done = true
				break
			}

			// fmt.Println(packet, hex.EncodeToString(packet.Payload))
			if packet.IsFinalMessage {
				fmt.Println("Final message is", packet.PacketNum)
				r.lastPacketFound = true
				r.lastPacketNum = packet.PacketNum
			}

			if r.packetsIngested == int(r.lastPacketNum)+1 && r.lastPacketFound {
				fmt.Println("packets ingested", r.packetsIngested, r.lastPacketNum+1)

				close(r.dataChannel)
			}

			// If the packet is next in order
			if packet.PacketNum == uint32(r.nextSequence) {
				fmt.Println("Adding packet", r.nextSequence)
				r.buffer = append(r.buffer, packet.Payload...)
				r.nextSequence++
			} else if packet.PacketNum > uint32(r.nextSequence) { // otherwise add it to be conumed later
				r.outOfOrderPackets[int(packet.PacketNum)] = packet.Payload
				fmt.Println("Adding out of order", packet.PacketNum, r.outOfOrderPackets)

			}

			// Consume any potential items in the out of order map
			for {
				// If the next packet is in the out of order map

				data, exists := r.outOfOrderPackets[r.nextSequence]

				if !exists {
					break
				}

				r.buffer = append(r.buffer, data...)
				delete(r.outOfOrderPackets, r.nextSequence)
				r.nextSequence++
			}
		default:
			// fmt.Println("No items to consume")
		}
	}

	n := copy(p, r.buffer)
	r.buffer = r.buffer[n:]

	return n, nil

}

var (
	requests  = make(map[string](map[uint32]*PacketStream))
	requestMu sync.Mutex
)

func makeNewPacketStream() *PacketStream {
	return &PacketStream{
		dataChannel:       make(chan Packet, 10),
		nextSequence:      0,
		outOfOrderPackets: make(map[int][]byte),
		packetsIngested:   0,
		lastPacketNum:     0,
		lastPacketFound:   false,
	}
}

type Headers map[string]string

func parseHeaders(rawHeaders []byte) Headers {
	var headers Headers
	json.Unmarshal(rawHeaders, &headers)

	return headers

}

func ProxyDCMessage(rawData webrtc.DataChannelMessage, clientId string) {
	// fmt.Println(requests)
	reader := bytes.NewReader(rawData.Data)

	packet, err := ParsePacket(reader)

	// fmt.Println(packet)

	if err != nil {
		fmt.Println("Error parsing packet: ", err)
	}

	requestMu.Lock()
	if _, exists := requests[clientId]; !exists {
		requests[clientId] = make(map[uint32]*PacketStream)
	}

	if _, exists := requests[clientId][packet.StreamIdentifier]; !exists {

		requests[clientId][packet.StreamIdentifier] = makeNewPacketStream()
	}
	requestMu.Unlock()

	stream := requests[clientId][packet.StreamIdentifier]

	if packet.IsHeader {

		fmt.Println("Parsing header")

		headers := parseHeaders(packet.Payload)

		// Construct and make http request
		serverUrl := fmt.Sprintf("http://localhost:%s%s", ProxyPort, headers["url"])
		fmt.Println(serverUrl)
		req, err := http.NewRequest(headers["method"], serverUrl, stream)

		if err != nil {
			fmt.Println("Error creating request", err)
		}

		// Add headers
		for headerName, headerVal := range headers {
			req.Header.Add(headerName, headerVal)
		}

		client := &http.Client{}

		resp, err := client.Do(req)

		// clean up request
		delete(requests[clientId], packet.StreamIdentifier)

		if err != nil {
			fmt.Println("Error sending request", err)
			return
		}

		fmt.Println("Request has been sent", *resp)
		fmt.Println("Response", resp.Body)
		return

	}

	stream.dataChannel <- *packet

	if packet.IsFinalMessage {
		fmt.Println("Final message")
		// close(stream.dataChannel)
	}

}
