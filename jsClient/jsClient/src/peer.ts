import { log } from "./utils";

async function fetchICE() {

  const res = await fetch("https://important-eel-61.deno.dev/")

  return (await res.json())

}


async function logSelectedCandidatePair(pc: RTCPeerConnection) {
  const stats = await pc.getStats();
  let selectedCandidatePair;

  stats.forEach(report => {
    if (report.type === 'transport') {
      // Find ID of selected candidate pair
      selectedCandidatePair = report.selectedCandidatePairId;
    }
  });

  if (selectedCandidatePair) {
    const candidatePair = stats.get(selectedCandidatePair);
    if (candidatePair) {
      log(`Local Candidate: ${stats.get(candidatePair.localCandidateId).candidateType}, Address: ${stats.get(candidatePair.localCandidateId).address}`);
      log(`Remote Candidate: ${stats.get(candidatePair.remoteCandidateId).candidateType}, Address: ${stats.get(candidatePair.remoteCandidateId).address}`);
    }
  }
}

export async function connect() {
  return new Promise<{ pc: RTCPeerConnection, dc: RTCDataChannel }>(async (resolve, reject) => {
    const serverId = (new URLSearchParams(window.location.search)).get("id")

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

    const socket = new WebSocket(`${signalingServer}/?role=client&id=${serverId}`)

    socket.onmessage = e => {
      let msg = JSON.parse(e.data)
      if (!msg) {
        return console.log('failed to parse msg')
      }
      switch (msg.mtype) {
        case "idAssgn":
          clientId = msg.id
          break

        case "candidate":
          pc.addIceCandidate(msg.candidate)
          break

        case "answer":
          pc.setRemoteDescription(msg.answer)
          break

        case "heartbeat":

          break

        default:
          console.log("Unknown path: ", msg.mtype)
      }
    }

    socket.onerror = e => {
      reject(e)
    }

    let dc = pc.createDataChannel('data')
    dc.onmessage = event => {
      log("From server: " + event.data)
      // logSelectedCandidatePair(pc);

    }

    dc.onopen = () => {
      resolve({ pc, dc })
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

    socket.onopen = () => {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer)
        socket.send(JSON.stringify({ mtype: "offer", id: serverId, offer: offer, clientId }))
      })
    }
  })


}