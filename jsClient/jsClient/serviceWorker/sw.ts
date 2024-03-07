/// <reference lib="WebWorker" />

import { createPackets } from "./createPacket";


class Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void = () => {};
    reject: (reason?: any) => void = () => {};

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

class HTTPProxy {

    // a list of requests
    // { id: request }
    requests: Record<string, Deferred<any>> = {}

    async makeRequest(request: Request) {

        // make id
        const id = crypto.randomUUID()
        // send request to pc
        // @ts-ignore
        const clients = await self.clients.matchAll()

        createPackets(request)

        if (!clients[0]) {
            return
        }

        clients[0].postMessage()

        const prom = new Deferred()

        this.requests[id] = prom

        return prom.promise
    }

    handleRequest(reqObj) {
        console.log(this.requests, reqObj)
        // resolve promise with data
        this.requests[reqObj.id].resolve(reqObj.body)
    }

}

const proxy = new HTTPProxy()


self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
});

let lastClient

self.addEventListener("fetch", async event => {
    // console.log(event)

    event.respondWith(
        (async () => {

            if (event.clientId !== lastClient) {
                lastClient = event.clientId
                console.log("Detected restart")
                return fetch(event.request)
            }

            if (!peerConnected) {
                return fetch(event.request)
            }

            console.log(new URL(event.request.url).origin)
            console.log(event.request)
            console.log(event.request.headers.get("Content-Type"))
            console.log(new URL(event.request.url).pathname)

            const timeout = new Promise((resolve, reject) => {
                setTimeout(async () => {
                    console.log("Timed out")

                    resolve(
                        fetch(event.request)
                    )
                }, 4000)
            })

            const body = proxy.makeRequest(event.request)

            const res = Promise.race([timeout, body])
            console.log(res)
            return res

            // console.log(atob(body))

            // return new Response(JSON.parse(atob(body)))
        })(),
    );
});

var peerConnected = false

self.addEventListener("message", (event) => {
    console.log(`Message received: ${event.data}`);

    if (event.data === "connected") {
        peerConnected = true

        return
    }

    if (event.data === "disconnected") {
        peerConnected = false
        return
    }

    // proxy.handleRequest(JSON.parse(event.data))
});
