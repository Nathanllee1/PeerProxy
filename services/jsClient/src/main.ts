import './style.css'

async function fetchICE() {

  const res = await fetch("https://important-eel-61.deno.dev/")
  
  return (await res.json())

}

function log(text: string | undefined) {

  const root = document.getElementById("app")
  const newElement = document.createElement("div")
  console.log(text)
  newElement.textContent = JSON.stringify(text, undefined, 2)

  root?.append(
    newElement
  )

}

async function main() {
  const serverId = (new URLSearchParams(window.location.search)).get("id")

  // const signalingServer = "ws://localhost:8080"
  const signalingServer = "wss://d1syxz7xf05rvd.cloudfront.net"

  
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
  
    log(msg)
  
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


  
  let dc = pc.createDataChannel('data')
  dc.onmessage = event => {
    log("From server: " + event.data)
  }
  
  pc.onicecandidate = e => {
    if (e.candidate && e.candidate.candidate !== "") {
      socket.send(JSON.stringify({mtype: "candidate", id: serverId, candidate: e.candidate, clientId}))
    }
  }
  
  pc.oniceconnectionstatechange = () => {
    log("State: " + pc.connectionState)
  }
  
  socket.onopen = () => {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer)
      socket.send(JSON.stringify({mtype: "offer", id: serverId, offer: offer, clientId}))
    })
  }
}

main()