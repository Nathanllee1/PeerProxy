package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

type Stream struct {
	dataChannel chan Packet
	mu          sync.Mutex
	closed      bool
	once        sync.Once
}

func (s *Stream) Close() {
	s.once.Do(func() {
		close(s.dataChannel)
		s.closed = true
		fmt.Println("Stream closed")
	})
}

func (s *Stream) IsClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.closed
}

type PacketStream struct {
	stream            Stream
	buffer            []byte
	done              bool
	nextSequence      int
	outOfOrderPackets map[int][]byte
	lastPacketNum     uint32
	lastPacketFound   bool
	packetsIngested   int
	cancel            context.CancelFunc
}

func sendPacket(dc *webrtc.DataChannel, packet *Packet) error {

	err := dc.Send(packet.Serialize())

	if err != nil {
		fmt.Println("Error sending packet", err)

		return err
	}

	return nil

}

func makePackets(stream io.ReadCloser, dc *webrtc.DataChannel, streamIdentifier uint32, ctx context.Context, cancel context.CancelFunc) {
	// const payloadSize = 16*1024 - 11
	const payloadSize = 65535 - 11

	buffer := make([]byte, payloadSize)

	packetNum := 0

	var payload []byte

	for {
		select {
		case <-ctx.Done():
			fmt.Println("Context done")
			return
		default:
			n, err := io.ReadFull(stream, buffer)
			// fmt.Println("Read", n, err, buffer[:n])
			payload = buffer
			if err != nil {
				if err == io.EOF {
					// End of file reached
					finalPacket := Packet{
						StreamIdentifier: streamIdentifier,
						PacketNum:        uint32(packetNum),
						PayloadLength:    uint16(0),
						IsHeader:         false,
						IsFinalMessage:   true,
						Payload:          make([]byte, 0),
					}

					dc.Send(finalPacket.Serialize())
					return
				}
				if err == io.ErrUnexpectedEOF {
					// Last chunk might be less than chunk size, process what was read
					payload = buffer[:n]
				}
			}

			bodyPacket := Packet{
				StreamIdentifier: streamIdentifier,
				PacketNum:        uint32(packetNum),
				PayloadLength:    uint16(len(payload)),
				IsHeader:         false,
				IsFinalMessage:   false,
				Payload:          payload,
			}

			err = sendPacket(dc, &bodyPacket)

			if err != nil {
				// close ctx
				cancel()

			}

			packetNum++

			// time.Sleep(10 * time.Millisecond)
		}
	}

}

func (r *PacketStream) Read(p []byte) (int, error) {
	// fmt.Println("Reading")
	//fmt.Printf("Read called: len(buffer)=%d, done=%v\n", len(r.buffer), r.done)
	fmt.Printf("Stream address in Read: %p\n", r)

	if r.done && len(r.buffer) == 0 && len(r.outOfOrderPackets) == 0 {
		fmt.Println("Done reading")
		return 0, io.EOF
	}

	for len(r.buffer) == 0 && !r.done {
		//fmt.Println("Waiting for packet")
		packet, ok := <-r.stream.dataChannel

		//fmt.Println(packet, ok)

		r.packetsIngested++

		if !ok {
			r.done = true
			break
		}

		// fmt.Println(packet, hex.EncodeToString(packet.Payload))
		if packet.IsFinalMessage {
			//fmt.Println("Final message is", packet.PacketNum)
			r.lastPacketFound = true
			r.lastPacketNum = packet.PacketNum
		}

		if r.packetsIngested == int(r.lastPacketNum)+1 && r.lastPacketFound {
			// fmt.Println("packets ingested", r.packetsIngested, r.lastPacketNum+1)

			r.stream.Close()
		}

		// If the packet is next in order
		if packet.PacketNum == uint32(r.nextSequence) {
			// fmt.Println("Adding packet", r.nextSequence)
			r.buffer = append(r.buffer, packet.Payload...)
			r.nextSequence++
		} else if packet.PacketNum > uint32(r.nextSequence) { // otherwise add it to be conumed later
			r.outOfOrderPackets[int(packet.PacketNum)] = packet.Payload
			// fmt.Println("Adding out of order", packet.PacketNum)

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
	}

	n := copy(p, r.buffer)
	r.buffer = r.buffer[n:]

	return n, nil

}

type Headers map[string]string

func parseHeaders(rawHeaders []byte) Headers {
	var headers Headers
	json.Unmarshal(rawHeaders, &headers)

	return headers

}

func makeResponseHeaders(resp *http.Response, streamIdentifier uint32) *Packet {

	resp.Header["status"] = []string{resp.Status}
	resp.Header["status_code"] = []string{strconv.Itoa(resp.StatusCode)}

	respHeaders, err := json.Marshal(resp.Header)

	if err != nil {
		fmt.Println("Error parsing response headers:", err)
	}

	// fmt.Println(respHeaders)

	packet := Packet{
		PacketNum:        0,
		PayloadLength:    uint16(len(respHeaders)),
		IsFinalMessage:   true,
		IsHeader:         true,
		StreamIdentifier: streamIdentifier,
		Payload:          respHeaders,
	}

	return &packet
}

func ProxyDCMessage(rawData webrtc.DataChannelMessage, clientId string, dc *webrtc.DataChannel) {
	// fmt.Println(requests)
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered from panic:", r)
		}
	}()
	reader := bytes.NewReader(rawData.Data)

	packet, err := ParsePacket(reader)

	if packet.IsHeartbeat {
		return
	}

	if packet.IsCancel {
		fmt.Println("Canceling request", packet.StreamIdentifier)

		if stream, exists := Requests.GetStream(clientId, packet.StreamIdentifier); exists {

			stream.cancel()
		}
		return
	}

	if err != nil {
		fmt.Println("Error parsing packet: ", err)
	}

	// If the client doesn't exist, create it
	if _, exists := Requests.GetClient(clientId); !exists {
		Requests.NewClient(clientId)
	}

	// If the stream doesn't exist, create it
	if _, exists := Requests.GetStream(clientId, packet.StreamIdentifier); !exists {
		err := Requests.AddStream(clientId, packet.StreamIdentifier)

		if err != nil {
			fmt.Println("Error adding stream", err)
			return
		}
	}

	stream, _ := Requests.GetStream(clientId, packet.StreamIdentifier)

	// Handle a body packet
	if !packet.IsHeader {
		//fmt.Println("Body", packet.StreamIdentifier, packet.IsFinalMessage, stream)

		// check if data channel is closed
		if stream.stream.IsClosed() {
			//fmt.Println("Send channel closed")
			return
		}
		fmt.Printf("Stream address in ProxyDCMessage: %p\n", stream)

		stream.stream.dataChannel <- *packet

		//fmt.Println("Sent packet", packet.StreamIdentifier)
		return
	}

	// Handle a header packet and start an http request
	ctx, cancel := context.WithCancel(context.Background())
	stream.cancel = cancel

	headers := parseHeaders(packet.Payload)

	// Construct and make http request
	serverUrl := fmt.Sprintf("http://localhost:%s%s", ProxyPort, headers["url"])
	// fmt.Println(headers["method"], serverUrl)
	req, err := http.NewRequest(headers["method"], serverUrl, stream)

	req = req.WithContext(ctx)

	if err != nil {
		fmt.Println("Error creating request", err)
	}

	// Add headers
	for headerName, headerVal := range headers {
		// fmt.Println("Adding header", headerName, headerVal)
		req.Header.Add(headerName, headerVal)
	}

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		fmt.Println("Redirecting")
		return http.ErrUseLastResponse
	}}

	//fmt.Println("REQUEST", time.Now().Format("15:04:05"), headers["method"], serverUrl, packet.StreamIdentifier)

	resp, err := client.Do(req)

	if err != nil {
		fmt.Println("Error sending request", err)
		return
	}
	defer resp.Body.Close()

	fmt.Println(time.Now().Format("15:04:05"), headers["method"], resp.StatusCode, serverUrl, '\n')

	// clean up request

	headerPacket := makeResponseHeaders(resp, packet.StreamIdentifier)
	dc.Send(headerPacket.Serialize())

	makePackets(resp.Body, dc, packet.StreamIdentifier, ctx, cancel)

	Requests.RemoveStream(clientId, packet.StreamIdentifier)

	if RecordRequest {
		go Writer.LogRequest()

	}

}
