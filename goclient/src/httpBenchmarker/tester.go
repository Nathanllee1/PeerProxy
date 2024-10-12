package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"time"
)

const (
	url        = "http://localhost:3000"
	trials     = 1000
	mb         = 1024 * 1024
	numMBs     = 5
	bufferSize = mb * numMBs
)

var client = &http.Client{
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		MaxConnsPerHost:     100, // This limits the maximum number of connections per host
	},
}

func main() {
	for i := 0; i < trials; i++ {
		start := time.Now()

		resp, err := client.Get(fmt.Sprintf("%s/buffer?size=%d", url, bufferSize))
		if err != nil {
			fmt.Println("Error:", err)
			continue
		}
		// Read response body to complete the request
		_, err = ioutil.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			fmt.Println("Error reading response:", err)
			continue
		}

		end := time.Since(start).Seconds()

		fmt.Printf("%.2f MBs\n", float64(numMBs)/end)
	}
}
