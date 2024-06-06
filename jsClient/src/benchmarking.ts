import { createFrame } from "../serviceWorker/createPacket";
import { HTTPProxy } from "../serviceWorker/requestHandler";


async function testPackets() {
    console.log("Testing packets")

    const proxy = new HTTPProxy()

    const res = await proxy.makeRequest(new Request("https://www.google.com"), null)

    
}

async function testSerialization() {

    const n = 100000

    // 16kb
    const dataSize = 1024 * 16

    const data = new Uint8Array(dataSize)
    const start = performance.now()
    for (let i = 0; i < n; i++) {
        createFrame(0, "BODY", data, false, 0, false)
    }

    const end = performance.now()

    console.log(`Took ${end - start}ms to serialize ${n} frames`)

    // ops per second
    console.log((n / ((end - start) / 1000)).toFixed(2), "ops/s")

}

function makeBenchmarkButton(text: string, callback: () => void) {
    const button = document.createElement("button")
    button.innerText = text
    button.addEventListener("click", callback)

    document.body.appendChild(button)
}

export function setupBenchamrking() {
    makeBenchmarkButton("Test packets", testPackets)
    makeBenchmarkButton("Test Serialization", testSerialization)
}
