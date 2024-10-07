package main

import (
	"encoding/json"
	"fmt"
	"goClient/src/common"

	"github.com/pion/webrtc/v4"
)

// returns an array of dummy packets
func GetDummyData(dummySize int32, streamId uint32) []common.Packet {

	packets := []common.Packet{}
	emptyJSON, _ := json.Marshal(map[string]interface{}{
		"status":      []string{"ok"},
		"status_code": []string{"200"}})

	headerPacket := common.Packet{
		StreamIdentifier: streamId,
		PacketNum:        0,
		PayloadLength:    uint16(len(emptyJSON)),
		IsHeader:         true,
		IsFinalMessage:   true,
		Payload:          emptyJSON,
	}

	fmt.Println("header packet", headerPacket)

	packets = append(packets, headerPacket)

	packetNum := 0
	// packets are 64kb, make right numbe rof packet to reach dummySize
	for i := int32(0); i < dummySize; i += 6000 {

		bodyPacket := common.Packet{
			StreamIdentifier: (streamId),
			PacketNum:        uint32(packetNum),
			PayloadLength:    uint16(6000),
			IsHeader:         false,
			IsFinalMessage:   false,
			Payload:          make([]byte, 6000),
		}
		packets = append(packets, bodyPacket)

		packetNum++

	}

	// last packet
	bodyPacket := common.Packet{
		StreamIdentifier: (streamId),
		PacketNum:        uint32(packetNum),
		PayloadLength:    uint16(0),
		IsHeader:         false,
		IsFinalMessage:   true,
		Payload:          make([]byte, 0),
	}

	packets = append(packets, bodyPacket)

	return packets

}

func SendDummyData(dummySize int32, streamId uint32, dc *webrtc.DataChannel) {
	packets := GetDummyData(dummySize, streamId)

	fmt.Println("Sending", len(packets), "packets")

	for _, packet := range packets {
		dc.Send(packet.Serialize())
	}
}
