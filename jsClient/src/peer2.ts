import { fetchICE } from "./peer"
import { log, logSelectedCandidatePair, timers } from "./utils"

// Waits for the service worker ws to be ready
async function waitForWS(serverId: string, registration: ServiceWorkerRegistration) {

    return new Promise<void>(async (resolve, reject) => {

        const reqId = crypto.randomUUID()

        navigator.serviceWorker.addEventListener("message", (message) => {
            if (message.data.type !== "createWs") {
                return
            }

            const msg = message.data.payload

            if (msg.reqId !== reqId) {
                return
            }
            resolve()
        })

        registration.active?.postMessage({
            type: "createWs",
            payload: { serverId, reqId }
        })

    })

}

async function waitForId(registration: ServiceWorkerRegistration) {
    return new Promise<string>((resolve, reject) => {
        registration.active?.postMessage(
            {
                type: "signalingMessage",
                payload: JSON.stringify({
                    mtype: "idReq",
                    
                })
            }
        )
        navigator.serviceWorker.addEventListener("message", (message) => {

            if (message.data.type !== "signalingMessage") {
                return
            }

            const msg = JSON.parse(message.data.payload)

            if (msg.mtype === "idAssgn") {
                resolve(msg.id)

            }

        })

    })
}

function generateRandomCode() {

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const codeLength = 5;
    let randomCode = '';

    for (var i = 0; i < codeLength; i++) {
        var randomIndex = Math.floor(Math.random() * characters.length);
        randomCode += characters[randomIndex];
    }

    return randomCode;
}

export async function connectSW(serverId: string, registration: ServiceWorkerRegistration) {
    return new Promise<{ dc: RTCDataChannel, pc: RTCPeerConnection, stats: { wsTime: number } }>(async (resolve, reject) => {

        const iceServers = await fetchICE()
        let pc = new RTCPeerConnection(
            {
              iceServers: iceServers
            }
          )

        pc.oniceconnectionstatechange = () => {
            log("State: " + pc.connectionState)

            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                logSelectedCandidatePair(pc);
            }
        }

        let dc = pc.createDataChannel('data', {})
        dc.bufferedAmountLowThreshold = 10240
        dc.binaryType = "arraybuffer"

        let wsTime = 0
        dc.onopen = () => {
            resolve({ dc, pc, stats: { wsTime }} )
        }


        pc.addEventListener("icecandidate", (e) => {
            if (!e.candidate || e.candidate.candidate === "") {
                return
            }


            registration.active?.postMessage(
                {
                    type: "signalingMessage",
                    payload: JSON.stringify({
                        mtype: "candidate",
                        id: serverId,
                        candidate: e.candidate,
                        clientId
                    })
                }
            )
        })

        navigator.serviceWorker.addEventListener("message", (message) => {
            if (message.data.type !== "signalingMessage") {
                return
            }

            const msg = JSON.parse(message.data.payload)

            switch (msg.mtype) {
                case "idAssgn":
                    // clientId = msg.id
                    // log(clientId)
                    break

                case "candidate":
                    pc.addIceCandidate(msg.candidate)
                    break

                case "answer":
                    pc.setRemoteDescription(msg.answer)
                    break

                case "heartbeat":

                    break

                case "Error":
                    console.error(msg)
                    break

                default:
                    console.log("Unknown path: ", msg.mtype)
            }
        })

        timers.start("Websocket connection")
        await waitForWS(serverId, registration)
        wsTime = timers.end("Websocket connection")

        console.log("Waiting for ID")
        console.time("id assigned in")
        let clientId = await waitForId(registration)
        console.timeEnd("id assigned in")
        const offer = await pc.createOffer()
        pc.setLocalDescription(offer)

        registration.active?.postMessage(
            {
                type: "signalingMessage",
                payload: JSON.stringify({ mtype: "offer", id: serverId, offer: offer, clientId })
            }
        )

        console.log("Offer sent")


    })


}