/// <reference lib="webworker" />

class Deferred {
    promise
    resolve
    reject

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

const makeJSON = (obj) => {
    let props = []
    for (let prop in obj) {
        props.push(prop)
    }
    return JSON.parse(JSON.stringify(obj, props))
}

class HTTPProxy {

    // a list of requests
    // { id: request }
    requests = {}

    async makeRequest(request) {

        // make id
        const id = crypto.randomUUID()
        // send request to pc
        const clients = await self.clients.matchAll()

        if (!clients[0]) {
            return
        }

        let req = makeJSON(request)

        req.url = new URL(req.url).pathname

        clients[0].postMessage(JSON.stringify({
            request: req,
            id
        }))

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
    console.log(event)
    event.respondWith(
        (async () => {

            if (event.clientId !== lastClient) {
                lastClient = event.clientId
                console.log("DIFF")
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
