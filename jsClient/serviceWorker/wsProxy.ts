export class WsHandler {
    ws: WebSocket
    serverId: string
    client: Client
    open = false

    wsClosed = true

    needsRestart = false

    constructor(serverId: string, client: Client) {
        const signalingServer = "wss://peepsignal.fly.dev"
        this.serverId = serverId
        this.ws = new WebSocket(`${signalingServer}/?role=client&id=${serverId}`)
        
        this.setNewClient(client)
        this.ws.addEventListener("open", () => {
            this.open = true
        })

        this.ws.addEventListener("close", () => {
            this.needsRestart = true
        })
    }

    // Returns when websocket is open
    async ready() {

        if (this.open) {
            return
        }

        return new Promise<void>((resolve, reject) => {
            this.ws.addEventListener("open", () => {
                resolve()
            })
        })
    }

    setNewClient(client: Client) {
        this.client = client

        this.ws.addEventListener("message", (event) => {
            client.postMessage({ type: "signalingMessage", payload: event.data })
        })
    }

}