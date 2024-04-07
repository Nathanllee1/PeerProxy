import { createDom } from './createDom';
import { connect } from './peer'
import './style.css'
import { log, sleep } from './utils'

const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

async function main() {

  const registration = await waitForSW()

  registration.active?.postMessage({
    type: "disconnected"
  })

  console.time("connecting")
  const [{ dc }] = await Promise.all([connect()])
  console.timeEnd("connecting")

  // navigator.registerProtocolHandler('web+webrtc', 'http://localhost:5173/?id=%s')


  dc.onmessage = event => {
    //console.log(event.data)

    registration.active?.postMessage({type: "data", payload: event.data}, [event.data])
  }

  registration.active?.postMessage({
    type: "ready",
  })

  navigator.serviceWorker.addEventListener("message", (message) => {
    dc.send(message.data)
  })

  log("Connected")

  console.log("Fetching page for", window.location.pathname)
  //sleep(1000)
  await createDom(window.location.pathname)


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