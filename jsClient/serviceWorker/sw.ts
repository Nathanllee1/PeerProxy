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

    // console.log(peerConnected, client.frameType, event.request.url, event)


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

    if (url.pathname === "/iframe-peerproxy.html" || url.pathname === "/iframeScript-peerproxy.js") {
        return fetch(event.request)
    }

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
            // console.log("Disconnected, resetting")
            peerConnected = false
            proxy.reset()
            break;
        case "ready":
            peerConnected = true;

            client.postMessage({
                type: "ready"
            })

            break;

        case "cancelRequests":
            console.log("Cancelling requests")
            proxy.cancelAllRequests()
            break;

        case "data":
            proxy.handleRequest(event.data.payload);
            break;
    }

});
