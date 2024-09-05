import puppeteer from "puppeteer";

async function run() {
    // get first argument, can be "latency", "throughput", or "loadtest"

    const test = process.argv[2]

    const url = process.argv[3]

    console.log("Test:", test)

    if (!test) {
        console.error("No test specified. latency or throughput")
        return
    }

    // launch puppeteer
    const browser = await puppeteer.launch({
        // headless: false
    });

    const page = await browser.newPage();

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: './results',
      })

    await page.goto(`${url}/benchmarking/sizetest.html?test=${test}`);

    console.log("Page loaded")

    

}

run()