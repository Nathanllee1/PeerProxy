export class DataChannelSendQueue {
    private dataChannel: RTCDataChannel;
    private queue: Array<ArrayBuffer>;
    private sending: boolean;
    private maxBufferedAmount: number;

    constructor(dataChannel: RTCDataChannel, maxBufferedAmount: number = 160 * 1024) {
        this.dataChannel = dataChannel;
        this.queue = [];
        this.sending = false;
        this.maxBufferedAmount = maxBufferedAmount;

        // Set the threshold to half of maxBufferedAmount
        this.dataChannel.bufferedAmountLowThreshold = maxBufferedAmount / 2;

        this.dataChannel.addEventListener('bufferedamountlow', () => {
            this.processQueue();
        });


    }

    send(data: ArrayBuffer): void {

        this.dataChannel.send(data);
        return

        if (this.canSendImmediately(data)) {
            try {
                this.dataChannel.send(data);
                return;
            } catch (error) {
                if (error instanceof DOMException && error.name === "OperationError") {
                    // Can't send now, will queue the data
                } else {
                    throw error;
                }
            }
        }

        // Queue the data and attempt to process the queue
        this.queue.push(data);
        this.processQueue();
    }

    setDataChannel(dc: RTCDataChannel): void {
        this.dataChannel = dc;
    }

    private canSendImmediately(data: ArrayBuffer): boolean {
        const canSend = this.dataChannel.bufferedAmount + data.byteLength <= this.maxBufferedAmount;
        return canSend && this.dataChannel.readyState === "open";
    }

    private processQueue(): void {
        if (this.sending) return;
        this.sending = true;

        if (this.dataChannel.readyState !== "open") {
            this.sending = false;
            return;
        }

        while (this.queue.length > 0) {
            const data = this.queue[0];

            if (!this.canSendImmediately(data)) {
                break;
            }

            try {
                this.dataChannel.send(data);
                this.queue.shift();
            } catch (error) {
                if (error instanceof DOMException && error.name === "OperationError") {
                    // Can't send now, will try again when bufferedamountlow event fires
                    break;
                } else {
                    throw error;
                }
            }
        }

        this.sending = false;
    }
}
