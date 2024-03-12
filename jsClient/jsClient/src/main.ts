import { connect } from './peer'
import './style.css'
import { log } from './utils'

const waitForSW = async () => {
  const registration = await navigator.serviceWorker.ready;

  return registration
}

async function main() {

  const [registration, {dc}] = await Promise.all([waitForSW(), connect()])

  const myImage = await fetch("/test.jpg")
  const content = await myImage.blob()

  const formData = new FormData();

  // Append the blob to the FormData instance.
  // You can give it a filename "image.jpg"
  formData.append("file", content, "image.jpg");

  registration.active?.postMessage("connected")
  
  navigator.serviceWorker.addEventListener("message", (message) => {
    console.log("From sw", message.data)
    dc.send(message.data)
  }) 
  
  log("Connected") 

  const httpHeaders = {
    "X-My-Custom-Header": "Zeke are cool",
  };
  const myHeaders = new Headers(httpHeaders);


  setTimeout(async () => {
    await fetch("/foobar", {
      body: formData,
      method: "POST",
      headers: myHeaders
    })

  }, 200)
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