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


function createHeaderPacket(request: Request, currentIdentifier: number): ArrayBuffer {
    // Create header packet
    let formattedHeaders: Record<string, string> = {}

    for (const header of request.headers.keys()) {
        formattedHeaders[header] = request.headers.get(header)!
    }

    formattedHeaders["method"] = request.method
    formattedHeaders["url"] = new URL(request.url).pathname

    // TODO: come up with a more efficient header representation
    const encodedHeader = new TextEncoder().encode(JSON.stringify(formattedHeaders))
    const frame = createFrame(currentIdentifier, "HEADER", encodedHeader, true, 0);

    return frame

}

const packetSizeBytes = 16 * 1024
const payloadSize = packetSizeBytes - 7

export async function createPackets(request: Request, currentIdentifier: number, cb: (buf: ArrayBuffer) => void) {
    cb(createHeaderPacket(request, currentIdentifier))

    // Make body packets
    if (!request.body) {
        const endFrame = createFrame(currentIdentifier, "BODY", new Uint8Array(), true, 0);
        // console.log(endFrame)
        cb(endFrame)
        return
    }

    const reader = request.body?.getReader()
    console.log(reader)
    if (!reader) {
        console.log(request)
        
        throw Error("Readable stream does not exist on reader")
    }

    let frameNum = 0;

    while (true) {
        // Stream the body
        const { done, value } = await reader?.read()
        console.log(done)
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

export type Packet = {
    identifier: number
    sequenceNum: number
    payload: Uint8Array
    messageType: "HEADER" | "BODY",
    finalMessage: boolean
};

export function parsePacket(buffer: ArrayBuffer): Packet {
    // console.log(buffer)
    const headerSize = 11;
    let view = new DataView(buffer);

    // Read the values from the buffer
    let identifier = view.getUint32(0);
    let sequenceNum = view.getUint32(4);
    let payloadLength = view.getUint16(8);
    let flags = view.getUint8(10);

    const flagCodes = {
        0: [false, false],
        1: [false, true],
        2: [true, false],
        3: [true, true]
    }

    const [finalMessage, messageType] = flagCodes[flags]

    // Extract the payload
    let payload = new Uint8Array(buffer, headerSize, payloadLength);

    // Construct the JSON object
    return {
        identifier,
        sequenceNum,
        payload,
        messageType: messageType ? "HEADER" : "BODY",
        finalMessage,
    };
}