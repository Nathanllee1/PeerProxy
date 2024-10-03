# Define source directories for client and server
CLIENT_SRC_DIR := ./src/client
SERVER_SRC_DIR := ./src/localproxyserver

# Define the output directory
BIN_DIR := bin

# Define binary names
CLIENT_BINARY_NAME := client
SERVER_BINARY_NAME := localproxyserver

# Define the platforms (replace slashes with dashes for target names)
PLATFORMS := linux-amd64 windows-amd64 darwin-amd64

# Ensure the bin directory exists
$(BIN_DIR):
	mkdir -p $(BIN_DIR)

# Default target to build for all platforms and both binaries
all: $(PLATFORMS:%=build-%-all)
.PHONY: all

# Build client and server for each platform
build-%-all: build-%-client build-%-server
.PHONY: build-%-all

# Build client binary for each platform
build-linux-amd64-client: $(BIN_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BIN_DIR)/$(CLIENT_BINARY_NAME)-linux-amd64 $(CLIENT_SRC_DIR)
.PHONY: build-linux-amd64-client

build-windows-amd64-client: $(BIN_DIR)
	GOOS=windows GOARCH=amd64 go build -o $(BIN_DIR)/$(CLIENT_BINARY_NAME)-windows-amd64.exe $(CLIENT_SRC_DIR)
.PHONY: build-windows-amd64-client

build-darwin-amd64-client: $(BIN_DIR)
	GOOS=darwin GOARCH=amd64 go build -o $(BIN_DIR)/$(CLIENT_BINARY_NAME)-darwin-amd64 $(CLIENT_SRC_DIR)
.PHONY: build-darwin-amd64-client

# Build server binary for each platform
build-linux-amd64-server: $(BIN_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BIN_DIR)/$(SERVER_BINARY_NAME)-linux-amd64 $(SERVER_SRC_DIR)
.PHONY: build-linux-amd64-server

build-windows-amd64-server: $(BIN_DIR)
	GOOS=wi
