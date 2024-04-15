/// <reference lib="WebWorker" />

import { HTTPProxy } from "./requestHandler";
import { WsHandler } from "./wsProxy";

const proxy = new HTTPProxy()

let ws: WsHandler

self.addEventListener('install', (event) => {
    console.log('Service Worker installing.', self);

    self.skipWaiting()
});

self.addEventListener('activate', function (e) {
    //  self.registration.unregister()
    console.log("Activating")

    self.clients.claim()
});

let lastClient: string = ""

self.addEventListener("fetch", async (untypedEvent) => {

    const event = untypedEvent as FetchEvent

    event.respondWith(
        (async (): Promise<Response> => {
            // console.log(new URL(event.request.url).hostname)

            if (event.clientId !== lastClient || !peerConnected) {
                peerConnected = false
                lastClient = event.clientId
                console.log("Detected restart")
                return fetch(event.request)
            }

            const client = await self.clients.get(event.clientId)

            if (!client || !peerConnected) {
                return fetch(event.request)
            }

            const clientHostname = new URL(client.url).hostname

            // iF the request is not for the proxy, fetch it normally
            if (new URL(event.request.url).hostname !== clientHostname) {
                return fetch(event.request)
            }

            // console.log(event.request)

            const body = await proxy.makeRequest(event.request, client)

            return body

        })(),
    );
});



var peerConnected = false

self.addEventListener("message", async (event) => {
    const clientObj = event.source as unknown as Client
    const client = await self.clients.get(clientObj.id)

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

            // console.log(event.data.payload)

            if (!ws) {
                console.error("No ws connection")
            }

            // console.log(ws)

            ws.ws.send(event.data.payload)

            break;


    }

});
