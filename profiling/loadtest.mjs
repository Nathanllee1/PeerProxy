import puppeteer from 'puppeteer';
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function loadTest(url, payload) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(url)

  await sleep(5000);  // Delay between requests

  for (let i = 0; i < 1000; i++) {  // Number of requests
    console.log("Evaluating")

    await page.evaluate((url, payload) => {
      
      fetch("/", {
        method: 'GET',
        
      });
    }, url, payload);
  }

  await browser.close();
}

const url = 'https://foo.peerproxy.dev';
const payload = 'param1=value1&param2=value2';  // Replace with your payload

loadTest(url, payload);