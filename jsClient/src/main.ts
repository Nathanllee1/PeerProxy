import { createFrame } from '../serviceWorker/createPacket';
import { createDom } from './createDom';
import { connect } from './peer'
import { connectSW } from './peer2';
import './style.css'
import { log, sleep, timer, timers } from './utils'
import { createTimeline, test_connection } from './wrtcBenchmarks';

export const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

const debug = true
export const enableIframe = true

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

export function getId() {
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

function enableClientSideRouting() {
  
  document.addEventListener('DOMContentLoaded', function () {
    document.body.addEventListener('click', async function (event) {
      const target = event.target;

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
      await createDom(url); // Load content dynamically

      // Update the URL in the browser address bar
      window.history.pushState({ path: url }, '', url);

      console.log("going to ", url)
    });
  });

  window.addEventListener('popstate', async function (event) {
    console.log("going back!", event.state, event.state?.path, window.location.pathname)
    // Handle browser navigation (forward/back)
    if (event.state && event.state.path) {
      await createDom(event.state.path);
      return
    }

    await createDom(window.location.pathname, );
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
  enableClientSideRouting()

  const id = getId()
  const registration = await initializeSW()

  // const [{ dc, pc }] = await Promise.all([connect(id)])

  timers.start("connecting sw")
  const { dc, pc, stats } = await connectSW(id, registration, true)
  sendHeartbeat(dc)
  timers.end("connecting sw")

  timers.end("connecting")

  createTimeline(stats.events)

  // navigator.registerProtocolHandler('web+webrtc', 'http://localhost:5173/?id=%s')
  navigator.serviceWorker.addEventListener("message", (message) => {
    switch (message.data.type) {
      case "data":
        dc.send(message.data.payload)
        break
    }
  })

  dc.onmessage = event => {
    // console.log( event.data)
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
