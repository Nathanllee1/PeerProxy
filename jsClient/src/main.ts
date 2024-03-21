import { createDom } from './createDom';
import { connect } from './peer'
import './style.css'
import { log } from './utils'

const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

async function main() {
  console.time("connecting")
  const [registration, { dc }] = await Promise.all([waitForSW(), connect()])
  console.timeEnd("connecting")

  dc.onmessage = event => {
    //console.log(event.data)

    registration.active?.postMessage(event.data, [event.data])
  }

  registration.active?.postMessage("connected")

  navigator.serviceWorker.addEventListener("message", (message) => {
    dc.send(message.data)
  })

  log("Connected")

  setTimeout(async() => {
    console.log("Fetching page for", window.location.pathname)
    await createDom(window.location.pathname)

  }, 700)

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