/// <reference lib="WebWorker" />

import { createPackets, Packet, parsePacket } from "./createPacket";
import { HTTPProxy } from "./requestHandler";
import { CustomStream } from "./streamHandler";



const proxy = new HTTPProxy()


self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');

    event.waitUntil(
        // Perform installation steps
        self.skipWaiting() // Forces activation
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
    // event.waitUntil(self.clients.claim());

});

let lastClient: string = ""

self.addEventListener("fetch", async (event) => {
    console.log(event)

    event.respondWith(
        (async (): Promise<Response> => {

            if (event.clientId !== lastClient) {
                peerConnected = false
                lastClient = event.clientId
                console.log("Detected restart")
                return fetch(event.request)
            }


            if (!peerConnected) {
                return fetch(event.request)
            }

            console.log(event.request)
            /*
            const timeout = new Promise<Response>((resolve, reject) => {
                setTimeout(async () => {
                    console.log("Timed out")

                    resolve(
                        fetch(event.request)
                    )
                }, 10000)
            })
            */

            const body = await proxy.makeRequest(event.request)

            // TODO: better lifecycle management

            return body

            // console.log(atob(body))
            // return new Response(JSON.parse(atob(body)))
        })(),
    );
});

var peerConnected = false

self.addEventListener("message", (event) => {

    if (event.data === "connected") {
        peerConnected = true
        return
    }

    if (event.data === "disconnected") {
        peerConnected = false
        return
    }

    proxy.handleRequest(event.data)
});
