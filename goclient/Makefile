# Define the source directory and output directory
SRC_DIR := ./src/*
BIN_DIR := bin

# Define the binary name
BINARY_NAME := peerproxy

# Define the platforms
PLATFORMS := linux/amd64 windows/amd64 darwin/amd64

# Ensure the bin directory exists
$(BIN_DIR):
	mkdir -p $(BIN_DIR)

# Default target to build for all platforms
all: $(PLATFORMS)
.PHONY: all

# Build targets for each platform
linux/amd64: $(BIN_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BIN_DIR)/$(BINARY_NAME)-linux-amd64 $(SRC_DIR)
.PHONY: linux/amd64

windows/amd64: $(BIN_DIR)
	GOOS=windows GOARCH=amd64 go build -o $(BIN_DIR)/$(BINARY_NAME)-windows-amd64.exe $(SRC_DIR)
.PHONY: windows/amd64

darwin/amd64: $(BIN_DIR)
	GOOS=darwin GOARCH=amd64 go build -o $(BIN_DIR)/$(BINARY_NAME)-darwin-amd64 $(SRC_DIR)
.PHONY: darwin/amd64

# Clean up build artifacts
clean:
	rm -rf $(BIN_DIR)/*
.PHONY: clean
