package main

import (
	"encoding/binary"
	"io"
)

type Header struct {
	StreamIdentifier uint32
	PacketNum        uint32
	PayloadLength    uint16
	Flags            uint8
}

type Flags struct {
	IsFinalMessage bool
	IsHeader       bool
}

type Packet struct {
	StreamIdentifier uint32
	PacketNum        uint32
	PayloadLength    uint16
	IsHeader         bool
	IsFinalMessage   bool
	Payload          []byte
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
		Payload:          payload,
	}, nil
}

func parseFlags(rawFlags uint8) Flags {

	var flags Flags
	messageType := rawFlags & 0x01
	flags.IsHeader = messageType == 0

	finalMessageFlag := (rawFlags >> 1) & 0x01
	flags.IsFinalMessage = finalMessageFlag == 1

	return flags
}
