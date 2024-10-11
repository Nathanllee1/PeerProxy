package main

import (
	"fmt"

	"github.com/pion/webrtc/v4"
)

type DataChannel struct {
	dc           *webrtc.DataChannel
	packetQueue  chan []byte
	blockPackets chan bool
}

const (
	bufferedAmountLowThreshold uint64 = 512 * 1024       // 512 KB
	maxBufferedAmount          uint64 = 1024 * 1024 * 10 // 1 MB
)

func NewDataChannel(dc *webrtc.DataChannel) *DataChannel {

	packetQueue := make(chan []byte, 100000) // Adjust the buffer size as needed

	dc.SetBufferedAmountLowThreshold(bufferedAmountLowThreshold)

	dataChannel := &DataChannel{
		dc:           dc,
		packetQueue:  packetQueue,
		blockPackets: make(chan bool),
	}

	dc.OnBufferedAmountLow(func() {
		fmt.Println("Buffered amount low")
		dataChannel.blockPackets <- false
	})

	go dataChannel.processQueue()

	return dataChannel
}

func (dataChannel *DataChannel) AddPacket(packet []byte) {
	dataChannel.packetQueue <- packet

	// dataChannel.dc.Send(packet)
}

func (dataChannel *DataChannel) processQueue() {

	for {
		select {
		case packet := <-dataChannel.packetQueue:
			dataChannel.dc.Send(packet)

			if dataChannel.dc.BufferedAmount() > maxBufferedAmount {
				dataChannel.blockPackets <- true
				fmt.Println("Blocking packets")
			}

		case <-dataChannel.blockPackets:
			fmt.Println("Blocked")
		}
	}

}
