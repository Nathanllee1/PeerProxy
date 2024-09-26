import { setupBenchamrking } from './benchmarking';
import { createDom, setupIframe } from './createDom';
import { ConnectionManager } from './peer'
import './style.css'
import { log, logSelectedCandidatePair, timers } from './utils'
import { createTimeline } from './wrtcBenchmarks';

export const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

// gets the queryparameter "peerproxydebug" and returns true if it is "true"
export const debug = new URLSearchParams(window.location.search).get("peerproxydebug") === "true"
export const enableIframe = true

async function initializeSW() {

  const registration = await waitForSW()

  registration.active?.postMessage({
    type: "disconnected"
  })

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

  if (searchParams.has("peerproxyid")) {
    // redirect to subdomain with peerproxyid
    window.location.href = `https://${searchParams.get("peerproxyid")}.${hostname}${window.location.pathname}`
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



export let registration: ServiceWorkerRegistration

async function main() {
  timers.start("connecting")

  const id = getId()
  console.log("ID", id)


  let iframe: HTMLIFrameElement
  iframe = await setupIframe()

  registration = await initializeSW()

  const connectionManager = new ConnectionManager(id)
  const { dc, stats, pc } = await connectionManager.connect()

  console.log("Connecting took", timers.end("connecting"))


  logSelectedCandidatePair(pc)


  if (debug) {
    setupBenchamrking(pc)
    createTimeline(stats.events)
  }

  // registerProtocolHandler()

  navigator.serviceWorker.addEventListener("message", (message) => {
    switch (message.data.type) {
      case "data":
        // dc.send(message.data.payload)
        // console.log("Sending data", message.data.payload)
        connectionManager.send(message.data.payload)
        // dc.send(message.data.payload)

        break

      case "set-cookie":
        iframe.contentDocument!.cookie = message.data.payload

        break

      default:
        // console.log("Unknown message", message.data)
        break
    }
  })

  connectionManager.addEventListener("message", event => {
    registration.active?.postMessage({ type: "data", payload: event.detail }, [event.detail])
  })

  await waitForSWReady(registration)

  log("Connected")


  await createDom(window.location.pathname, iframe)


}

main()