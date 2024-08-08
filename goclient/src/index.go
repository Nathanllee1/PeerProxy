package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	_ "net/http/pprof"

	"github.com/alecthomas/kong"
)

type CLI struct {
	Port          int    `arg:"" name:"port" help:"Port number to listen on."`
	ID            string `optional:"" name:"id" help:"Identifier for the peer."`
	FullProxy     bool   `optional:"" name:"fullProxy" help:"Enable or disable full proxy mode."`
	RecordRequest bool   `optional:"" name:"recordRequest" help:"Enable or disable debug mode."`
}

var ProxyPort string = "3000"
var ServerId string = "foo"
var FullProxy bool = false
var RecordRequest bool = false

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
	var cli CLI
	ctx := kong.Parse(&cli,
		kong.UsageOnError(),
	)

	// Validate and use the parsed flags
	if cli.Port == 0 {
		fmt.Println("Usage: peerproxy <port> --id <id>")
		ctx.Exit(1)
	}

	RecordRequest = cli.RecordRequest

	if cli.RecordRequest {
		InitializeLog()

		go func() {
			log.Println(http.ListenAndServe("localhost:6060", nil))
		}()
	}

	ProxyPort = fmt.Sprintf("%d", cli.Port)
	ServerId = cli.ID

	if cli.ID == "" {
		ServerId = RandStringRunes(6)
	}

	FullProxy = cli.FullProxy

	Signal()

	// Prevent the main function from exiting
	select {}
}
