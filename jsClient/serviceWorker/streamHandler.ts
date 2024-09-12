import { Packet } from "./createPacket"

export class CustomStream {

    controller: ReadableStreamDefaultController
    stream: ReadableStream

    lastPacketFound = false
    lastPacketNum = 0
    packetsIngested = 0

    outOfOrderPackets = {}
    currentPacketNum = 0

    cancelled = false

    constructor() {
        // Keeping a reference to the stream controller

        // Creating a readable stream with an underlying source object
        this.stream = new ReadableStream({
            start: (controller) => {
                this.controller = controller;
            },
            pull: (controller) => {
                // This is called when the consumer wants to read data
                // You might not need to implement anything here if you're only pushing data manually
                
            },
            cancel: (reason) => {
                if (!this.stream.locked && this.controller) {
                    this.controller.close();
                }
                // console.log(`Stream cancelled, reason: ${reason}`);
                this.outOfOrderPackets = {}

                this.cancelled = true
            }
        });
    }

    // Method to add items to the stream
    addItem(item: Packet) {
        if (!this.controller) {
            console.error("Stream controller is not initialized.");
        }

        // ignore if stream is cancelled
        if (this.cancelled) {
            return
        }

        this.packetsIngested++;

        if (item.finalMessage) {
            this.lastPacketFound = true
            this.lastPacketNum = item.sequenceNum

        }

        if (item.sequenceNum == this.currentPacketNum) {
            this.controller.enqueue(item.payload);
            this.currentPacketNum ++

        } else if (item.sequenceNum > this.currentPacketNum) {
            this.outOfOrderPackets[item.sequenceNum] = item.payload
        }

        while (true) {

            if (! (this.currentPacketNum in this.outOfOrderPackets)) {
                break
            }


            this.controller.enqueue(this.outOfOrderPackets[this.currentPacketNum])
            delete this.outOfOrderPackets[this.currentPacketNum]

            this.currentPacketNum++

        }

        
        if (this.packetsIngested === this.lastPacketNum + 1 && this.lastPacketFound && this.currentPacketNum === this.lastPacketNum + 1) {
            // console.log("Closing stream", item)

            this.closeStream()
            
        }

        return


    }

    // Method to close the stream
    closeStream() {
        this.outOfOrderPackets = {}

        if (this.controller) {
            this.controller.close();
        }
    }
}
