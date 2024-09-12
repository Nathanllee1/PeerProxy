import { cookieManager } from "./cookieManager";
import { createFrame, createPackets, parsePacket } from "./createPacket";
import { CustomStream } from "./streamHandler";

class Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void = () => { };
    reject: (reason?: any) => void = () => { };

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

export class HTTPProxy {

    // a list of requests
    // { id: request }
    requests: Record<number, Deferred<Response>> = {}

    responses: Record<number, CustomStream> = {}

    currentIdentifier = 1

    client: Client

    reset() {
        this.requests = {}
        this.responses = {}
        // this.currentIdentifier = 1
    }

    async makeRequest(request: Request, client: Client): Promise<Response> {
        // console.log("Requesting", request.url, client.id)
        this.client = client
        
        await createPackets(request, this.currentIdentifier, (frame) => {
            client.postMessage({payload: frame, type: "data"})
        })

        const prom = new Deferred<Response>()

        this.requests[this.currentIdentifier] = prom
        this.currentIdentifier += 1

        return prom.promise
    }

    cancelAllRequests() {
        for (const id in this.requests) {
            
            this.requests[id].reject("Request cancelled")

            const cancelFrame = createFrame(parseInt(id), "BODY", new Uint8Array(), true, 0, false, true)

            this.client.postMessage({
                type: "data",
                payload: cancelFrame
            })

        }
        this.reset()
    }

    handleRequest(reqObj: ArrayBuffer) {
        const packet = parsePacket(reqObj)

        if (packet.messageType === "BODY") {

            if (!this.responses[packet.identifier]) {
                console.error("No response found for", packet.identifier)
                return
            }

            this.responses[packet.identifier].addItem(packet)

            return
        }

        const parsedHeaders: Record<string, string[]> = JSON.parse(new TextDecoder().decode(packet.payload))
        const headers = new Headers()

        let statusText: string = "200 OK"
        let status: number = 200

        for (const headerKey in parsedHeaders) {

            if (headerKey === "status_code") {
                status = parseInt(parsedHeaders[headerKey][0])
                continue
            }

            if (headerKey === "status") {
                statusText = parsedHeaders[headerKey][0]
                continue
            }

            if (headerKey === "Set-Cookie") {
                console.log("Setting cookies", parsedHeaders[headerKey])
                for (const cookie of parsedHeaders[headerKey]) {

                    console.log("Setting cookie", cookie)
                    
                    cookieManager.setCookie(cookie) // This is the line that is causing the error;

                    this.client.postMessage({
                        type: "set-cookie",
                        payload: cookie
                    })

                    // document.cookie = cookie

                }
                continue
            }

            headers.append(headerKey, parsedHeaders[headerKey].join(","))
        }

        const body = new CustomStream()
        this.responses[packet.identifier] = body

        const response = new Response(body.stream, {
            headers,
            status,
            statusText,
            
        })

        this.requests[packet.identifier].resolve(response)
    }

}