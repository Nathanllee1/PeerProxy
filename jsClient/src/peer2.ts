import { fetchICE } from "./peer"
import { log, logSelectedCandidatePair, timers } from "./utils"
import { DataSet } from 'vis-timeline/standalone'

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

type cachedConnection = {
    time: number,
    candidates: RTCIceCandidate[],
    answer: RTCSessionDescription,
    offer: RTCSessionDescriptionInit

}

type cachedCandidate = {
    time: number,
    peerCandidates: RTCIceCandidate[],
    selfCandidates: RTCIceCandidate[]
}



const CACHE_LIFE = 5000
function loadCachedCandidates(pc: RTCPeerConnection, forwardIceCandidate: (candidate: RTCIceCandidate) => void) {

    const cachedCandidate = sessionStorage.getItem("candidates")
    if (!cachedCandidate) {
        return
    }

    const candidates: cachedCandidate = JSON.parse(cachedCandidate)
    console.log(Date.now(), candidates.time)
    /*
    if (Date.now() - candidates.time > CACHE_LIFE) {
        return
    }
    */

    console.log("Using cached candidates")

    candidates.selfCandidates.forEach(candidate => {
        pc.addIceCandidate(candidate)
    })

    candidates.peerCandidates.forEach(forwardIceCandidate)

}


async function getCachedConnection() {
    const { pc, dc } = await createPCDC()
    // attempt to load and use cached candidates
    const cached = sessionStorage.getItem("candidates")

    if (!cached) {
        return
    }

    const { time, candidates, answer, offer } = JSON.parse(cached) as cachedConnection

    if (Date.now() - time > 5000) {
        return
    }

    return new Promise<{ pc: RTCPeerConnection, dc: RTCDataChannel }>((resolve, reject) => {
        console.log(candidates)
        console.log("Using cached candidates")

        pc.setLocalDescription(offer)
        pc.setRemoteDescription(answer)

        candidates.forEach((c) => {
            pc.addIceCandidate(c)
        })

        dc.onopen = () => {
            resolve({ pc, dc })
        }
    })


}

async function createPCDC() {
    const iceServers = await fetchICE()
    let pc = new RTCPeerConnection(
        {
            iceServers: iceServers
        }
    )

    let dc = pc.createDataChannel('data', {
        ordered: false,
    })
    dc.bufferedAmountLowThreshold = 10240
    dc.binaryType = "arraybuffer"

    return { pc, dc }
}

async function connectToWs(events: DataSet<any>, serverId: string, registration: ServiceWorkerRegistration) {
    timers.start("Websocket connection")
    await waitForWS(serverId, registration)
    const wsTime = timers.end("Websocket connection")
    events.add({ id: 5, content: "WS Connecting", start: new Date().getTime() - wsTime, end: new Date(), group: "Signaling" })

    console.log("Waiting for ID")
    timers.start("id assigned in")
    const clientId = await waitForId(registration)
    const idAssigned = timers.end("id assigned in")
    events.add({ id: 6, content: "ID Assigned", start: new Date().getTime() - idAssigned, end: new Date(), group: "Signaling" })

    return {clientId, wsTime}
}

export async function connectSW(serverId: string, registration: ServiceWorkerRegistration, useCachedCandidates = false) {
    /*
    const cachedConnection = await getCachedCandidates()

    if (cachedConnection) {
        return cachedConnection
    }
    */

    const events = new DataSet()
    events.add({ id: 0, content: "Connection Started", start: new Date(), group: "Connection" })

    return new Promise<{ dc: RTCDataChannel, pc: RTCPeerConnection, stats: { wsTime: number, events: DataSet<any> } }>(async (resolve, reject) => {
        timers.start("iceservers")
        const [{ pc, dc }, {wsTime, clientId}] = await Promise.all([createPCDC(), connectToWs(events, serverId, registration)])

        const iceTime = timers.end("iceservers")
        events.add({ content: "Fetching ICE Servers", start: new Date().getTime() - iceTime, end: new Date(), group: "Connection" })


        pc.oniceconnectionstatechange = () => {
            log("State: " + pc.connectionState)

            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                logSelectedCandidatePair(pc);
            }
        }


        const cachedCandidates: cachedCandidate = {
            time: Date.now(),
            peerCandidates: [],
            selfCandidates: []
        }

        dc.onopen = () => {

            events.add({ id: 1, content: "Data Channel Opened", start: new Date(), group: "Connection" })

            resolve({ dc, pc, stats: { wsTime, events } })

            sessionStorage.setItem("candidates", JSON.stringify(cachedCandidates))
            console.timeEnd("answer to connection")
        }


        pc.addEventListener("icecandidate", (e) => {
            if (!e.candidate || e.candidate.candidate === "") {
                return
            }

            events.add({ content: "ICE Candidate", start: new Date(), group: "Client Ice Candidate" })

            cachedCandidates.selfCandidates.push(e.candidate)

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

            if (clientId && msg.clientId !== clientId) {
                return
            }

            switch (msg.mtype) {
                case "idAssgn":
                    // clientId = msg.id
                    // log(clientId)
                    break

                case "candidate":
                    cachedCandidates.peerCandidates.push(msg.candidate)
                    pc.addIceCandidate(msg.candidate)

                    events.add({ content: "ICE Candidate", start: new Date(), group: "Server Ice Candidate" })

                    break

                case "answer":
                    console.time("answer to connection")
                    pc.setRemoteDescription(msg.answer)

                    events.add({ content: "Answer Received", start: new Date(), group: "SDP Exchange" })

                    if (useCachedCandidates) {
                        loadCachedCandidates(pc, (candidate) => {
                            registration.active?.postMessage(
                                {
                                    type: "signalingMessage",
                                    payload: JSON.stringify({
                                        mtype: "candidate",
                                        id: serverId,
                                        candidate: candidate,
                                        clientId
                                    })
                                }
                            )
                        });
                    }

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



        const offer = await pc.createOffer()


        pc.setLocalDescription(offer)
        events.add({ id: 7, content: "Offer Created", start: new Date(), group: "SDP Exchange" })

        registration.active?.postMessage(
            {
                type: "signalingMessage",
                payload: JSON.stringify({ mtype: "offer", id: serverId, offer: offer, clientId })
            }
        )

        console.log("Offer sent")


    })


}