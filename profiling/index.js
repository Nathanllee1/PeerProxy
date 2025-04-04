const puppeteer = require('puppeteer');

const proxyURL = 'https://foo.peerproxy.dev/benchmarking/sizetest.html?test=latency';
const ngrokURL = 'https:/nathanlee.ngrok.io/benchmarking/sizetest.html?test=latency';

const TEST = 'pee'
const url = TEST === 'ngrok' ? ngrokURL : proxyURL;

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
    });
    const page = await browser.newPage();

    await page.goto(url);
    // await page.waitForFunction(() => typeof fetchSizes === 'function');

    // Start CPU profiling
    await page.tracing.start({ path: `tests/${TEST}-${new Date().toISOString()}` });

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    await sleep(10000)

    // Stop CPU profiling
    await page.tracing.stop();

    const metrics = await page.metrics();

    // Print metrics
    console.log('Performance metrics:', metrics);

    await browser.close();
})();