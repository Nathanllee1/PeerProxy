package main

import (
	"errors"
	"sync"
)

type clientRequest struct {
	clientMu *sync.RWMutex
	requests map[uint32]*PacketStream
}

func MakeNewClientRequest() *clientRequest {
	return &clientRequest{
		requests: make(map[uint32]*PacketStream),
		clientMu: &sync.RWMutex{},
	}
}

type requests map[string]*clientRequest

var (
	Requests  = make(requests)
	RequestMu sync.RWMutex
)

func MakeNewPacketStream() *PacketStream {
	return &PacketStream{
		stream:            Stream{dataChannel: make(chan Packet), mu: sync.Mutex{}, closed: false},
		nextSequence:      0,
		outOfOrderPackets: make(map[int][]byte),
		packetsIngested:   0,
		lastPacketNum:     0,
		lastPacketFound:   false,
	}
}

func (r *requests) GetClient(clientId string) (*clientRequest, bool) {
	RequestMu.RLock()
	defer RequestMu.RUnlock()

	clientReq, clientExists := (*r)[clientId]

	if !clientExists {
		return nil, false
	}

	return clientReq, true
}

func (r *requests) NewClient(clientId string) {
	RequestMu.Lock()
	defer RequestMu.Unlock()

	(*r)[clientId] = MakeNewClientRequest()
}

// returns a specific request from a client
func (r *requests) GetStream(clientId string, requestId uint32) (*PacketStream, bool) {
	client, clientExists := r.GetClient(clientId)

	if !clientExists {
		return nil, false
	}

	client.clientMu.RLock()
	defer client.clientMu.RUnlock()

	request, requestExists := client.requests[requestId]

	if !requestExists {
		return nil, false
	}

	return request, true
}

func (r *requests) AddStream(clientId string, requestId uint32) error {
	client, clientExists := r.GetClient(clientId)

	if !clientExists {
		return errors.New("client does not exist")
	}

	client.clientMu.Lock()
	defer client.clientMu.Unlock()

	client.requests[requestId] = MakeNewPacketStream()

	return nil
}

func (r *requests) RemoveStream(clientId string, requestId uint32) error {
	client, clientExists := r.GetClient(clientId)

	if !clientExists {
		return errors.New("client does not exist")
	}

	client.clientMu.Lock()
	defer client.clientMu.Unlock()

	delete(client.requests, requestId)

	return nil
}
