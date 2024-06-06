import { createFrame } from '../serviceWorker/createPacket';
import { setupBenchamrking } from './benchmarking';
import { createDom, setupIframe } from './createDom';
import { connect } from './peer'
import { connectSW } from './peer2';
import './style.css'
import { log, sleep, timer, timers } from './utils'
import { createTimeline, test_connection } from './wrtcBenchmarks';

export const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

const debug = false
export const enableIframe = true

document.getElementById("makeDom")?.addEventListener("click", async () => {
  await createDom(window.location.pathname)
})



async function initializeSW() {

  console.time("waiting for SW")
  const registration = await waitForSW()

  console.log(registration)

  registration.active?.postMessage({
    type: "disconnected"
  })
  console.timeEnd("waiting for SW")

  return registration

}

export function getId() {
  const searchParams = new URLSearchParams(window.location.search);

  // Extract subdomain as serverId
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  let serverId = "foo";
  if (parts.length > 2) {
    serverId = parts.slice(0, parts.length - 2).join('.');
    return serverId
  }

  return serverId;
}


function waitForSWReady(registration: ServiceWorkerRegistration) {

  return new Promise<void>((resolve, reject) => {

    registration.active?.postMessage({
      type: "ready",
    })

    navigator.serviceWorker.addEventListener("message", (message) => {
      //console.log(message.data)
      if (message.data.type === "ready") {
        resolve()
      }
    })

  });

}

export function enableClientSideRouting(document: Document = window.document) {
  document.body.addEventListener('click', async function (event) {
    const target = event.target as HTMLLinkElement;

    if (!target) {
      return
    }

    if (target.tagName !== 'A' || !target.href) {
      return
    }
    const origin = new URL(target.href).origin

    if (origin !== window.location.origin) {
      return
    }

    event.preventDefault(); // Prevent the link from triggering a page load
    

    var url = target.href;
    window.parent.history.pushState({ path: url }, '', url);

    await createDom(url); // Load content dynamically
    console.log("going to ", url)

    // Update the URL in the browser address bar
    try {
      console.log("Updated parent history to ", url);
    } catch (error) {
      console.error("Failed to update parent history:", error);
    }
    console.log("going to ", url)
  });


  window.parent.addEventListener('popstate', async function (event) {
    console.log("going back!", event.state, event.state?.path, window.location.pathname)
    // Handle browser navigation (forward/back)
    if (event.state && event.state.path) {
      await createDom(event.state.path, document);
      return
    }

    await createDom(window.location.pathname, document);
  });

}

async function sendHeartbeat(dc: RTCDataChannel) {
  setInterval(() => {
    const testPacket = createFrame(0, 'HEADER', new Uint8Array(), true, 0, true)
    dc.send(testPacket)
  }, 1000)
}

async function main() {
  timers.start("connecting")

  const id = getId()
  console.log("ID", id)

  await setupIframe()

  const registration = await initializeSW()

  const { dc, pc } = await connect(id)

  let iframe: HTMLIFrameElement
  if (!debug) {
    iframe = await setupIframe()

  }

  if (debug) {
    setupBenchamrking()
  }

  console.log("Connected")

  timers.start("connecting sw")
  // const { dc, pc, stats } = await connectSW(id, registration, true)
  sendHeartbeat(dc)
  timers.end("connecting sw")

  timers.end("connecting")

  // createTimeline(stats.events)

  // navigator.registerProtocolHandler('web+webrtc', 'http://localhost:5173/?id=%s')
  navigator.serviceWorker.addEventListener("message", (message) => {
    switch (message.data.type) {
      case "data":
        dc.send(message.data.payload)
        break

      case "set-cookie":
        iframe.contentDocument!.cookie = message.data.payload

        break

      default:
        console.log("Unknown message", message.data)
        break
    }
  })

  dc.onmessage = event => {
    registration.active?.postMessage({ type: "data", payload: event.data }, [event.data])
  }

  console.time("waiting for connection")
  await waitForSWReady(registration)
  console.timeEnd("waiting for connection")

  log("Connected")

  if (!debug) {
    await createDom(window.location.pathname)
  }
}

main()