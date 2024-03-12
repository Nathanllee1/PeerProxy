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
    requests: Record<number, Deferred<any>> = {}
    currentIdentifier = 1
    async makeRequest(request: Request): Promise<Response> {
        // @ts-ignore
        const clients = await self.clients.matchAll()

        await createPackets(request, this.currentIdentifier, (frame) => {
            // console.log(frame)
            clients[0].postMessage(frame)

        })

        if (!clients[0]) {
            return new Response()
        }


        const prom = new Deferred<Response>()

        this.requests[this.currentIdentifier] = prom
        this.currentIdentifier += 1

        return prom.promise
    }

    handleRequest(reqObj: any) {
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

            console.log(new URL(event.request.url).origin)
            console.log(event.request)
            console.log(event.request.headers.get("Content-Type"))
            console.log(new URL(event.request.url).pathname)

            const timeout = new Promise<Response>((resolve, reject) => {
                setTimeout(async () => {
                    console.log("Timed out")

                    resolve(
                        fetch(event.request)
                    )
                }, 300)
            })

            const body = proxy.makeRequest(event.request)

            // TODO: better lifecycle management
            const res = Promise.race([timeout, body])
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
