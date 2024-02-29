package main

import (
	"fmt"
	"os"
)

var ProxyPort string = "3000"

func main() {

	if len(os.Args) == 2 {
		ProxyPort = os.Args[1]
	}

	fmt.Println("Using Port", ProxyPort)

	Signal()
	// Prevent the main function from exiting
	select {}
}
