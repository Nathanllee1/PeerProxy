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

        this.dataChannel.addEventListener('bufferedamountlow', () => {
            this.processQueue()
        });
    }

    async send(data: ArrayBuffer): Promise<void> {
        if (!this.canSendImmediately(data)) {
            console.log("Queuing ", data.byteLength, "bytes");
            this.queue.push(data);
            this.processQueue();
            return;
        }

        try {
            this.dataChannel.send(data);
        } catch (error) {
            if (error instanceof DOMException && error.name === "OperationError") {
                this.queue.push(data);
                this.processQueue();
            } else {
                throw error;
            }
        }
    }

    setDataChannel(dc: RTCDataChannel): void {
        this.dataChannel = dc;
    }

    private canSendImmediately(data: ArrayBuffer): boolean {
        const canSend = this.dataChannel.bufferedAmount + this.getDataSize(data) <= this.maxBufferedAmount;
        // console.log(canSend, this.dataChannel.readyState, this.dataChannel.bufferedAmount, this.getDataSize(data), this.maxBufferedAmount);

        return canSend && this.dataChannel.readyState === "open";
    }

    private processQueue(): void {
        if (this.dataChannel.readyState !== "open") return;

        console.log("Processing queue", this.queue.length, "items");

        this.sending = true;

        while (this.queue.length > 0) {
            const data = this.queue[0];

            if (!this.canSendImmediately(data)) break;

            this.dataChannel.send(data);
            this.queue.shift();
        }

        this.sending = false;
    }

    private getDataSize(data: ArrayBuffer): number {
        return data.byteLength;
    }
}
