/// <reference lib="WebWorker" />

import { HTTPProxy } from "./requestHandler";

const proxy = new HTTPProxy()


self.addEventListener('install', (event) => {
    console.log('Service Worker installing.', self);

    self.skipWaiting()
});

self.addEventListener('activate', function(e) {
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


            if (event.clientId !== lastClient) {
                peerConnected = false
                lastClient = event.clientId
                console.log("Detected restart")
                return fetch(event.request)
            }

            // TODO: implement caching
            if (await self.clients.get(event.clientId) !== undefined) {
                const clientHostname = new URL((await self.clients.get(event.clientId)).url).hostname

                if (new URL(event.request.url).hostname !== clientHostname) {
                    return fetch(event.request)
                }
    
            }
           
            if (event) {

                if (!peerConnected) {
                    return fetch(event.request)
                }
            }

            console.log(event.request)

            const body = await proxy.makeRequest(event.request)

            return body

        })(),
    );
});

var peerConnected = false

self.addEventListener("message", (event) => {
    switch (event.data.type) {
        case "disconnected":
            console.log("Disconnected, resetting")
            peerConnected = false
            proxy.reset()
            break;
        case "ready":
            peerConnected = true;
            break;

        case "data":
            proxy.handleRequest(event.data.payload);
            break;
    }

});
