/// <reference lib="WebWorker" />


const IDENTIFIER_LENGTH = 32
const TYPE_LEGNTH = 1
const CONTENT_LENGTH = 16
const FLAGS = 8
const HEADER_LENGTH = IDENTIFIER_LENGTH + TYPE_LEGNTH + CONTENT_LENGTH + FLAGS

type MessageType = "HEADER" | "BODY"

/*
    | stream identifier (32 bits) | payload length (16 bits) | 
    | flags ( message type (1 bit)) (final message (1 bit))  | 
    | payload                                                |
*/
function createFrame(identifier: number, messageType: MessageType, payload: Uint8Array, finalMessage: boolean, sequenceNum: number) {

    const headerSize = 11

    let buffer = new ArrayBuffer(headerSize + payload.byteLength)
    let view = new DataView(buffer);

    view.setUint32(0, identifier)
    view.setUint32(4, sequenceNum)
    view.setUint16(8, payload.byteLength & 0xFFFF);


    let flags = (messageType === "HEADER" ? 0 : 1) | ((finalMessage ? 1 : 0) << 1)

    view.setUint8(10, flags)

    let payloadView = new Uint8Array(buffer, headerSize);
    payloadView.set(new Uint8Array(payload));

    return buffer;
}


function createHeaderPacket(headers: Headers, currentIdentifier: number): ArrayBuffer {
    // Create header packet
    let formattedHeaders: Record<string, string> = {}

    for (const header of headers.keys()) {
        formattedHeaders[header] = headers.get(header)!
    }

    // TODO: come up with a more efficient header representation
    const encodedHeader = new TextEncoder().encode(JSON.stringify(formattedHeaders))
    const frame = createFrame(currentIdentifier, "HEADER", encodedHeader, true, 0);

    return frame

}

const packetSizeBytes = 16 * 1024
const payloadSize = packetSizeBytes - 7

export async function createPackets(request: Request, currentIdentifier: number, cb: (buf: ArrayBuffer) => void) {

    cb(createHeaderPacket(request.headers, currentIdentifier))

    // Make body packets
    if (!request.body) {
        return
    }

    const reader = request.body?.getReader()
    if (!reader) {
        console.log(request)
        throw Error("Readable stream does not exist on reader")
    }

    let frameNum = 0;

    while (true) {
        // Stream the body
        const { done, value } = await reader?.read()
        if (done) {
            console.log("Last frame")
            const frame = createFrame(currentIdentifier, "BODY", new Uint8Array(), true, frameNum);
            cb(frame); // Assuming cb is a callback function for handling each frame
            break
        }

        if (!value) {
            break
        }

        let readerPosition = 0
        while (readerPosition < value.byteLength) {

            const slicedArray = value.slice(readerPosition, readerPosition + payloadSize)

            // check if last frame
            let lastFrame = false;
           

            const frame = createFrame(currentIdentifier, "BODY", slicedArray, lastFrame, frameNum);
            frameNum++
            cb(frame)

            readerPosition += payloadSize
        }
    }

    return
}