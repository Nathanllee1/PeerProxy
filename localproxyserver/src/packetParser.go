package main

import (
	"bytes"
	"encoding/binary"
	"io"
)

type Header struct {
	StreamIdentifier uint32
	PacketNum        uint32
	PayloadLength    uint16
	Flags            uint8
}

type Packet struct {
	StreamIdentifier uint32
	PacketNum        uint32
	PayloadLength    uint16
	IsHeader         bool
	IsFinalMessage   bool
	Payload          []byte
	IsHeartbeat      bool
	IsCancel         bool
}

func (p *Packet) Serialize() []byte {

	headerSize := 11
	buffer := make([]byte, headerSize+int(p.PayloadLength))

	buf := bytes.NewBuffer((buffer[:0]))

	binary.Write(buf, binary.BigEndian, p.StreamIdentifier)
	binary.Write(buf, binary.BigEndian, p.PacketNum)
	binary.Write(buf, binary.BigEndian, p.PayloadLength)

	flags := Flags{
		IsFinalMessage: p.IsFinalMessage,
		IsHeader:       p.IsHeader,
	}.MakeFlags()

	buf.WriteByte(flags)
	buf.Write(p.Payload)

	return buf.Bytes()

}

type Flags struct {
	IsFinalMessage bool
	IsHeader       bool
	IsHeartbeat    bool
	IsCancel       bool
}

func (flags Flags) MakeFlags() uint8 {
	var result byte
	if flags.IsHeader {
		result = 1
	} else {
		result = 0
	}
	if flags.IsFinalMessage {
		result |= 1 << 1 // Shift 1 left by 1 bit and OR it with result
	}
	return result
}

func ParsePacket(rawData io.Reader) (*Packet, error) {

	var header Header
	binary.Read(rawData, binary.BigEndian, &header)

	payload := make([]byte, header.PayloadLength)
	_, err := io.ReadFull(rawData, payload)

	if err != nil {
		return nil, err
	}

	flags := parseFlags(header.Flags)

	return &Packet{
		StreamIdentifier: header.StreamIdentifier,
		PacketNum:        header.PacketNum,
		PayloadLength:    header.PayloadLength,
		IsHeader:         flags.IsHeader,
		IsFinalMessage:   flags.IsFinalMessage,
		IsHeartbeat:      flags.IsHeartbeat,
		Payload:          payload,
		IsCancel:         flags.IsCancel,
	}, nil
}

func parseFlags(rawFlags uint8) Flags {

	var flags Flags
	messageType := rawFlags & 0x01
	flags.IsHeader = messageType == 1

	finalMessageFlag := (rawFlags >> 1) & 0x01
	flags.IsFinalMessage = finalMessageFlag == 1

	heartbeatFlag := (rawFlags >> 2) * 0x01
	flags.IsHeartbeat = heartbeatFlag == 1

	cancelFlag := (rawFlags >> 3) * 0x01
	flags.IsCancel = cancelFlag == 1

	return flags
}
