import { log, logSelectedCandidatePair, timers, timers } from "./utils";

export async function fetchICE() {

  const res = await fetch("https://important-eel-61.deno.dev/")

  return (await res.json())

}



export async function connect(serverId: string) {
  return new Promise<{ pc: RTCPeerConnection, dc: RTCDataChannel, stats: {wsTime: number} }>(async (resolve, reject) => {

    // const signalingServer = "ws://localhost:8080"
    // const signalingServer = "wss://d1syxz7xf05rvd.cloudfront.net"
    // const signalingServer = "wss://nathanlee.ngrok.io"
    const signalingServer = "wss://peepsignal.fly.dev"

    let clientId: string = ""

    const iceServers = await fetchICE()

    console.log(iceServers)

    let pc = new RTCPeerConnection(
      {
        iceServers: iceServers
      }
    )

    let wsTime: number;

    timers.start("Websocket connection")
    const socket = new WebSocket(`${signalingServer}/?role=client&id=${serverId}`)
    socket.addEventListener("open", () => {
      wsTime = timers.end("Websocket connection")
    })

    socket.onmessage = e => {
      let msg = JSON.parse(e.data)
      if (!msg) {
        return console.log('failed to parse msg')
      }
      switch (msg.mtype) {
        case "idAssgn":
          clientId = msg.id
          log(clientId)
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
    }

    socket.onerror = e => {
      reject(e)
    }

    let dc = pc.createDataChannel('data', {
      // ordered: true,

    })

    dc.bufferedAmountLowThreshold = 10240
    dc.onbufferedamountlow = () => {
      /* use send() to queue more data to be sent */
      console.log("buffered amount low")
    };

    dc.binaryType = "arraybuffer"

    dc.onopen = () => {
      resolve({ pc, dc, stats: { wsTime }})
    }

    pc.onicecandidate = e => {
      if (e.candidate && e.candidate.candidate !== "") {
        socket.send(JSON.stringify({ mtype: "candidate", id: serverId, candidate: e.candidate, clientId }))
      }
    }

    pc.oniceconnectionstatechange = () => {
      log("State: " + pc.connectionState)

      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        logSelectedCandidatePair(pc);
      }
    }

    socket.onopen = async () => {
      const offer = await pc.createOffer()
      pc.setLocalDescription(offer)
      socket.send(JSON.stringify({ mtype: "offer", id: serverId, offer: offer, clientId }))

    }
  })
}