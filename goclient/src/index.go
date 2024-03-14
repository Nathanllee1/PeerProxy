package main

import (
	"fmt"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
)

var ProxyPort string = "3000"

func main() {

	go func() {
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()

	if len(os.Args) == 2 {
		ProxyPort = os.Args[1]
	}

	fmt.Println("Using Port", ProxyPort)

	Signal()
	// Prevent the main function from exiting
	select {}
}
