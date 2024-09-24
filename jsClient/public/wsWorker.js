class WsHandler {
    ws
    serverId
    client
    open = false
    wsClosed = true
    needsRestart = false
    constructor(serverId, client) {
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
        return new Promise((resolve, reject) => {
            this.ws.addEventListener("open", () => {
                resolve()
            })
        })
    }
    setNewClient(client) {
        this.client = client
        this.ws.addEventListener("message", (event) => {
            client.postMessage({ type: "signalingMessage", payload: event.data })
        })
    }
}

let ws;

self.addEventListener('install', (event) => {
    console.log('Service Worker installing.', self);

    console.log(event)

    self.skipWaiting()
});

self.addEventListener('activate', function (e) {
    //  self.registration.unregister()
    console.log("Activating")

    self.clients.claim()

});

self.addEventListener('message', async function(event) {

    switch (event.data.type) {

        case "createWs":
            const clientObj = event.source
            const client = await self.clients.get(clientObj.id)
            console.log("CLIENT", client)
            if (!ws || ws.serverId !== event.data.payload.serverId || ws.needsRestart) {
                console.log("New WS")
                ws = new WsHandler(event.data.payload.serverId, client)
            }
            ws.setNewClient(client)
            await ws.ready()
            // Tell client ws is ready
            client.postMessage({
                type: "createWs",
                payload: {
                    reqId: event.data.payload.reqId
                }
            })
            break;

        case "signalingMessage":
            ws.ws.send(event.data.payload)
            break;

    }

});