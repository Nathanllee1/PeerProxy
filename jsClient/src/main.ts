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

  /*
  const myImage = await fetch("/test.jpg")
  const content = await myImage.blob()
  

  const formData = new FormData();

  // Append the blob to the FormData instance.
  // You can give it a filename "image.jpg"
  formData.append("file", content, "image.jpg");
  */

  dc.onmessage = event => {
    //console.log(event.data)

    registration.active?.postMessage(event.data, [event.data])
  }

  registration.active?.postMessage("connected")

  navigator.serviceWorker.addEventListener("message", (message) => {
    dc.send(message.data)
  })

  log("Connected")


  // window.location = window.location
  
  const rootdoc = await fetch("/")

  const content = await rootdoc.text()


  const div = document.createElement('div');
  div.appendChild(document.createTextNode(content));

  document.querySelector('html')!.innerHTML = content

  document.querySelectorAll('script').forEach(script => {
    console.log("Evaluating", script.innerText)
    eval(script.innerText);
  });
  


  /*
  //setInterval(async() => {
  const httpHeaders = {
    "X-My-Custom-Header": String(new Date().getTime()),
  };
  const myHeaders = new Headers(httpHeaders);
  const res = await fetch("/reflect", {
    body: formData,
    method: "POST",
    headers: myHeaders
  })

  const url = URL.createObjectURL(await res.blob())

  document.getElementById('displayedImage')!.src = url;

  console.log(url)

  */
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