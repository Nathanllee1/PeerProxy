import { createDom } from './createDom';
import { connect } from './peer'
import { connectSW } from './peer2';
import './style.css'
import { log, sleep } from './utils'

const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

const debug = false

document.getElementById("makeDom")?.addEventListener("click", async () => {
  await createDom(window.location.pathname)
})

async function initializeSW() {

  console.time("waiting for SW")
  const registration = await waitForSW()

  registration.active?.postMessage({
    type: "disconnected"
  })
  console.timeEnd("waiting for SW")

  return registration

}

function getId() {
  const searchParams = new URLSearchParams(window.location.search)

  const id = searchParams.get("id")
  let serverId = "foo"

  if (id) {
    serverId = id
    if (id.includes("://")) {
      serverId = id.split("://")[1]
    }
  }

  return serverId
}

async function main() {
  console.time("connecting")

  const id = getId()
  const registration = await initializeSW()

  // const [{ dc, pc }] = await Promise.all([connect(id)])
  const {dc, pc} = await connectSW(id, registration)

  console.timeEnd("connecting")

  // navigator.registerProtocolHandler('web+webrtc', 'http://localhost:5173/?id=%s')
  navigator.serviceWorker.addEventListener("message", (message) => {
    switch (message.data.type) {
      case "data":
        dc.send(message.data.payload)
        break
    }
  })

  dc.onmessage = event => {
    //console.log(event.data)
    registration.active?.postMessage({ type: "data", payload: event.data }, [event.data])
  }

  registration.active?.postMessage({
    type: "ready",
  })



  log("Connected")

  console.log("Fetching page for", window.location.pathname)

  const stats = await pc.getStats()
  stats.entries().forEach((entry) => {
    // console.log(entry)
  })

  if (!debug) {
    await createDom(window.location.pathname)
  }
}

main()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { type: 'module' })
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
