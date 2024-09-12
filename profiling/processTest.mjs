import puppeteer from "puppeteer";
import pidusage from "pidusage";
import fs from 'fs/promises';


const proxyURL = 'https://foo.peerproxy.dev/benchmarking/sizetest.html';
const ngrokURL = 'https:/nathanlee.ngrok.io/benchmarking/sizetest.html';

const TEST = 'ngrok'
const url = TEST === 'ngrok' ? ngrokURL : proxyURL;

export function getFormattedDateTime() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(now.getDate()).padStart(2, '0');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // Combine date and time parts into a single string, replacing ':' with '-'
    const formattedDateTime = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

    return formattedDateTime;
}

async function measurePerformance() {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url);

    if (!browser) {
        throw new Error("Browser not found");
    }

    const pid = browser.process().pid;

    const usages = []

    const monitoringInterval = setInterval(async () => {
        const stats = await pidusage(pid);

        usages.push(stats);

        // console.log(stats);
    }, 50);

    await page.evaluate(async () => {
        async function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        await sleep(10000)

        // await fetchSizes()
    });

    console.log(usages);

    // write usages to a file
    await fs.writeFile(`usages/${TEST}-${getFormattedDateTime()}.json`, 
        JSON.stringify(usages, null))

    clearInterval(monitoringInterval);

    await browser.close();

}

//measurePerformance()