package main

import (
	"bytes"
	"errors"
	"goClient/src/common"
	"io"
	"sync"
	"time"
)

// PacketStream manages the packets for a single request/response stream.
type PacketStream struct {
	mu             sync.Mutex
	cond           *sync.Cond
	headerPacket   *common.Packet
	bodyPackets    map[uint32]*common.Packet
	nextBodySeqNum uint32
	isClosed       bool
	headerReceived bool
	bodyBuffer     bytes.Buffer
	timeout        time.Duration
}

// NewPacketStream initializes a new PacketStream.
func NewPacketStream(timeout time.Duration) *PacketStream {
	ps := &PacketStream{
		bodyPackets:    make(map[uint32]*common.Packet),
		nextBodySeqNum: 0, // Start from 0 for body packets
		timeout:        timeout,
	}
	ps.cond = sync.NewCond(&ps.mu)
	return ps
}

// AddPacket adds a packet to the PacketStream.
func (ps *PacketStream) AddPacket(packet *common.Packet) {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	if packet.IsHeader {
		// fmt.Printf("Received header packet: PacketNum=%d\n", packet.PacketNum)
		ps.headerPacket = packet
		ps.headerReceived = true
		ps.cond.Broadcast()
	} else {
		// fmt.Printf("Received body packet: PacketNum=%d, IsFinalMessage=%v\n", packet.PacketNum, packet.IsFinalMessage)
		ps.bodyPackets[packet.PacketNum] = packet
		ps.cond.Broadcast()
	}

}

// ReadNextPacket waits for and returns the header packet payload.
func (ps *PacketStream) ReadNextPacket() ([]byte, error) {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	timeoutTimer := time.NewTimer(ps.timeout)
	defer timeoutTimer.Stop()

	for {
		if ps.headerReceived {
			return ps.headerPacket.Payload, nil
		}

		ps.mu.Unlock()
		select {
		case <-timeoutTimer.C:
			ps.mu.Lock()
			return nil, errors.New("timeout waiting for header packet")
		default:
			ps.mu.Lock()
			ps.cond.Wait()
		}
	}
}

// Read implements the io.Reader interface to read the response body.
func (ps *PacketStream) Read(p []byte) (int, error) {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	for {
		// Wait until the header is received.
		for !ps.headerReceived && !ps.isClosed {
			ps.cond.Wait()
		}

		if ps.headerReceived {
			// Check if there's data in the buffer.
			if ps.bodyBuffer.Len() > 0 {
				n, err := ps.bodyBuffer.Read(p)
				if err != nil {
					return n, err
				}
				return n, nil
			}

			// Process the next expected body packet.
			packet, exists := ps.bodyPackets[ps.nextBodySeqNum]
			if exists {
				delete(ps.bodyPackets, ps.nextBodySeqNum)
				ps.nextBodySeqNum++

				// Write packet payload to buffer.
				ps.bodyBuffer.Write(packet.Payload)

				if packet.IsFinalMessage {
					ps.isClosed = true
					ps.cond.Broadcast()
				}

				// Read from the buffer.
				n, err := ps.bodyBuffer.Read(p)

				if err != nil {

					return n, err
				}
				return n, nil
			}

			if ps.isClosed {
				if ps.bodyBuffer.Len() > 0 {
					n, err := ps.bodyBuffer.Read(p)
					if err != nil {
						return n, err
					}
					return n, nil
				}
				// No more data will be received.
				return 0, io.EOF
			}

			// Wait for more packets to arrive.
			ps.cond.Wait()
		} else if ps.isClosed {
			// Stream is closed but header not received.
			return 0, errors.New("stream closed before header was received")
		} else {
			// Wait for header to arrive.
			ps.cond.Wait()
		}
	}
}

// RequestManagerType manages all active PacketStreams.
type RequestManagerType struct {
	mu      sync.RWMutex
	streams map[uint32]*PacketStream
}

// RequestManager is a global instance of RequestManagerType.
var RequestManager = &RequestManagerType{
	streams: make(map[uint32]*PacketStream),
}

// AddStream adds a new PacketStream for a given stream ID.
func (rm *RequestManagerType) AddStream(streamID uint32, stream *PacketStream) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.streams[streamID] = stream
}

// GetStream retrieves a PacketStream by stream ID.
func (rm *RequestManagerType) GetStream(streamID uint32) (*PacketStream, bool) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	stream, exists := rm.streams[streamID]
	return stream, exists
}

// RemoveStream removes a PacketStream from the manager.
func (rm *RequestManagerType) RemoveStream(streamID uint32) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.streams, streamID)
}
