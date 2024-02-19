package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/pion/webrtc/v4"
)

// ICEConfig represents the structure of the ICE server response
type ICEServerConfig struct {
	URLs       []string `json:"urls"` // Use "urls" to match the JSON structure, accommodating both single and multiple URLs.
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

func (config *ICEServerConfig) UnmarshalJSON(data []byte) error {
	// Define a shadow struct to avoid infinite recursion during unmarshaling.
	var raw struct {
		URLs       interface{} `json:"urls"`
		Username   string      `json:"username,omitempty"`
		Credential string      `json:"credential,omitempty"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	config.Username = raw.Username
	config.Credential = raw.Credential

	switch v := raw.URLs.(type) {
	case string:
		config.URLs = []string{v}
	case []interface{}:
		for _, u := range v {
			if url, ok := u.(string); ok {
				config.URLs = append(config.URLs, url)
			}
		}
	default:
		return fmt.Errorf("unexpected type for URLs field")
	}

	return nil
}

// FetchICE fetches the ICE server configurations from the specified URL
func FetchICE(url string) ([]webrtc.ICEServer, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var iceConfig []ICEServerConfig
	err = json.Unmarshal(body, &iceConfig)
	if err != nil {
		return nil, err
	}

	log.Println(iceConfig)

	var iceServers []webrtc.ICEServer
	for _, server := range iceConfig {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs:       server.URLs,
			Username:   server.Username,
			Credential: server.Credential,
		})
	}

	return iceServers, nil
}
