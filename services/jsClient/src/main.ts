import { connect } from './peer'
import './style.css'
import { log } from './utils'

const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

async function main() {
  const {pc, dc} = await connect()

  const registration = await waitForSW()

  registration.active?.postMessage("connected")
  
  navigator.serviceWorker.addEventListener("message", (message) => {
    dc.send(message.data)
  })
  
  log("Connected")

  dc.send("Hello world!")
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