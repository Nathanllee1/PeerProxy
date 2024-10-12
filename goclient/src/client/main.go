package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	// Start WebRTC connection
	go Signal("foo")

	// Start HTTP server
	http.HandleFunc("/", handleHTTPRequest)

	fmt.Println("Starting HTTP server on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":3005", nil))
}

func handleHTTPRequest(w http.ResponseWriter, r *http.Request) {

	// Handle incoming HTTP requests
	ProxyHTTPRequest(w, r)
}
