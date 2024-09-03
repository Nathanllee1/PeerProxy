import { DataSet } from "vis-timeline/standalone";
import { displayError, log, logSelectedCandidatePair, timers, timers } from "./utils";
import { DataChannelSendQueue } from "./dataChannelQueue";
import { createFrame } from "../serviceWorker/createPacket";

export async function fetchICE() {

  const res = await fetch("https://important-eel-61.deno.dev/")

  return (await res.json())

}



export async function connect(serverId: string) {

  const events = new DataSet()
  events.add({ id: 0, content: "Connection Started", start: new Date(), group: "Connection" })

  return new Promise<{ pc: RTCPeerConnection, dc: RTCDataChannel, stats: { events: DataSet<any>, wsTime: number } }>(async (resolve, reject) => {

    // const signalingServer = "ws://localhost:8080"
    // const signalingServer = "wss://d1syxz7xf05rvd.cloudfront.net"
    // const signalingServer = "wss://nathanlee.ngrok.io"
    const signalingServer = "wss://peepsignal.fly.dev"

    let clientId: string = ""
    timers.start("iceservers")
    const iceServers = await fetchICE()
    const iceTime = timers.end("iceservers")
    events.add({ content: "Fetching ICE Servers", start: new Date().getTime() - iceTime, end: new Date(), group: "Connection" })

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
          events.add({ content: "ICE Candidate", start: new Date(), group: "Server Ice Candidate" })

          pc.addIceCandidate(msg.candidate)
          break

        case "answer":
          events.add({ content: "Answer Received", start: new Date(), group: "SDP Exchange" })

          pc.setRemoteDescription(msg.answer)
          break

        case "heartbeat":

          break

        case "Error":
          console.error(msg)
          displayError(msg.error)
          break

        default:
          console.log("Unknown path: ", msg.mtype)
      }
    }

    socket.onerror = e => {
      reject(e)
    }

    let dc = pc.createDataChannel('data', {
      ordered: false,
    })

    dc.onclose = () => {
      console.log("Datachannel Closed")
      connect(serverId)
    }
    
    dc.bufferedAmountLowThreshold = 102400
    dc.onbufferedamountlow = () => {
      console.log("buffered amount low")
    };
    

    dc.binaryType = "arraybuffer"

    dc.onopen = () => {
      events.add({ id: 1, content: "Data Channel Opened", start: new Date(), group: "Connection" })

      resolve({ pc, dc, stats: { wsTime, events } })
    }

    pc.onicecandidate = e => {
      if (e.candidate && e.candidate.candidate !== "") {
        events.add({ content: "ICE Candidate", start: new Date(), group: "Client Ice Candidate" })

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

      const wsTime = timers.end("Websocket connection")
      events.add({ content: "Websocket Connection Opened", start: new Date().getTime() - wsTime, end: new Date(), group: "Signaling" })

      const offer = await pc.createOffer()
      events.add({ id: 7, content: "Offer Created", start: new Date(), group: "SDP Exchange" })

      pc.setLocalDescription(offer)
      socket.send(JSON.stringify({ mtype: "offer", id: serverId, offer: offer, clientId }))

    }
  })
}

function sendHeartbeat(dc: RTCDataChannel) {
  return setInterval(() => {
    const testPacket = createFrame(0, 'HEADER', new Uint8Array(), true, 0, true)
    dc.send(testPacket)
  }, 1000)
}

export class ConnectionManager extends EventTarget {

  pc: RTCPeerConnection
  dc: RTCDataChannel

  queue: DataChannelSendQueue
  reconnectAttempts: number = 0
  maxReconnectAttempts: number = 5
  serverId: string
  heartbeat: NodeJS.Timeout

  constructor(serverId: string) {
    super()
    this.serverId = serverId
  }

  async connect() {
    console.log("Connecting to server", this.serverId)
    const { pc, dc, stats } = await connect(this.serverId)

    console.log("connected")

    this.pc = pc
    this.dc = dc

    if (!this.queue) {
      this.queue = new DataChannelSendQueue(dc)
    }

    this.queue.setDataChannel(dc)

    this.setupConnectionListeners()

    this.reconnectAttempts = 0

    clearInterval(this.heartbeat)
    this.heartbeat = sendHeartbeat(dc)

    dc.onmessage = (e) => {
      this.emitMessage(e.data)
    }

    return { pc, stats, dc }
  }

  setupConnectionListeners() {
    this.pc.oniceconnectionstatechange = async () => {
      if (this.pc.iceConnectionState === 'disconnected' || this.pc.iceConnectionState === 'failed') {
        await this.handleReconnection()
      }
    }

    this.dc.onclose = async () => {
      if (this.pc.iceConnectionState !== 'disconnected' && this.pc.iceConnectionState !== 'failed') {
        await this.handleReconnection()
      }
    }
  }

  async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached")
      return
    }

    console.log("Attempting to reconnect...")

    this.reconnectAttempts++
    await this.connect()

    // Optionally wait a bit before next reconnection attempt
    await new Promise(resolve => setTimeout(resolve, 2000))
  }


  async send(data: ArrayBuffer) {
    // console.log("Sending data")
    await this.queue.send(data)
  }

  emitMessage(data: ArrayBuffer) {
    this.dispatchEvent(new CustomEvent("message", { detail: data }))
  }




}
