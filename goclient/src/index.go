package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	_ "net/http/pprof"
	"os"
)

var ProxyPort string = "3000"
var ServerId string = "foo"

// Generate random 6 char string
var letterRunes = []rune("abcdefghijklmnopqrstuvwxyz")

func RandStringRunes(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}

func main() {

	go func() {
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()

	ServerId = RandStringRunes(6)

	if len(os.Args) >= 2 {
		ProxyPort = os.Args[1]

		if len(os.Args) == 3 {
			ServerId = os.Args[2]
		}
	}

	fmt.Println("Using Port", ProxyPort)
	fmt.Println("Requesting Id", ServerId)

	Signal()
	// Prevent the main function from exiting
	select {}
}
