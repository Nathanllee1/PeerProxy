package main

import (
	"fmt"
	"net/http"
)

func main() {

	url := "http://localhost:2342"

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		fmt.Println("Redirecting")
		return http.ErrUseLastResponse
	}}

	req, err := http.NewRequest("GET", url, nil)

	resp, err := client.Do(req)

	if err != nil {
		fmt.Println("Error sending request", err)
		return
	}
	defer resp.Body.Close()

	fmt.Println(resp)
}
