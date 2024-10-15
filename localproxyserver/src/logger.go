package main

import (
	"os"
	"strconv"
	"sync"
	"time"
)

type JSONWriter struct {
	file *os.File
	mu   sync.Mutex
}

var Writer *JSONWriter

// initialize a new file to store logs that is named the time and date
func InitializeLog() {
	// make a new file with the current time and date
	filename := "logs/" + time.Now().Format("2006-01-02T15-04-05") + ".json"
	file, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)

	if err != nil {
		panic(err)
	}

	Writer = &JSONWriter{file: file}
}

func (w *JSONWriter) LogRequest() {
	w.mu.Lock()
	defer w.mu.Unlock()

	currentTime := time.Now().Unix()

	w.file.Write([]byte(`{"time": ` + strconv.FormatInt(currentTime, 10) + `}` + "\n"))
}
