/// <reference lib="WebWorker" />

import { HTTPProxy } from "./requestHandler";
import { WsHandler } from "./wsProxy";

const proxy = new HTTPProxy()

let ws: WsHandler

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

let lastClient: string = ""

const iframeMode = true

async function timeout(ms: number, event: FetchEvent, client: Client) {
    const timeout = new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(fetch(event.request))
        }, ms)
    })

    return Promise.race([proxy.makeRequest(event.request, client)])
}


let pageClient: Client
async function handleIframeRequest(event: FetchEvent, client: Client) {
    // console.log({peerConnected})

    if (!client) {
        return fetch(event.request)
    }

    // console.log(client.frameType, event.request.url)


    const clientHostname = new URL(client.url).hostname
    if (new URL(event.request.url).hostname !== clientHostname) {
        return fetch(event.request)
    }

    const isRootPage = event.request.headers.get("x-root-page") ? true : false
    // console.log("Rootpage?!!", isRootPage)
    if (isRootPage) {
        pageClient = client

        return proxy.makeRequest(event.request, client)
    }

    if (client.frameType === "top-level") {
        return fetch(event.request)
    }

    const url = new URL(event.request.url)

    if (url.pathname === "/iframe.html" || url.pathname === "/iframeScript.js") {
        return fetch(event.request)
    }

    // get cookies from request
    const cookies = event.request.headers.get("cookie")
    console.log(cookies)

    return proxy.makeRequest(event.request, pageClient)

}

self.addEventListener("fetch", async (untypedEvent) => {

    const event = untypedEvent as FetchEvent
    // console.log(new URL(event.request.url).hostname)
    event.respondWith(
        (async (): Promise<Response> => {
            const client = await self.clients.get(event.clientId)

            return handleIframeRequest(event, client)


        })(),
    );
});



var peerConnected = false

self.addEventListener("message", async (event) => {
    const clientObj = event.source as unknown as Client
    const client = await self.clients.get(clientObj.id)
    // console.log(event, self.clients)
    switch (event.data.type) {
        case "disconnected":
            console.log("Disconnected, resetting")
            peerConnected = false
            proxy.reset()
            break;
        case "ready":
            peerConnected = true;

            client.postMessage({
                type: "ready"
            })

            break;

        case "data":
            proxy.handleRequest(event.data.payload);
            break;

        case "createWs":

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

            // console.log(event.data.payload)

            if (!ws) {
                console.error("No ws connection")
            }

            // console.log(ws)

            ws.ws.send(event.data.payload)

            break;


    }

});
