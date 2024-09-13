// opens a browser and gets the logs. Does it 30 times and then averages the results
import puppeteer from "puppeteer";

async function getConnectionTime(page, pageURL) {

    return new Promise(async (resolve, reject) => {
        page.on('console', (msg) => {
            // console.log(msg.text())
            if (msg.text().includes("Connecting took")) {
                resolve(msg.text().split(" ")[2])
            }
        })

        await page.goto(pageURL)

    })
}

async function run() {
    const browser = await puppeteer.launch({  })

    for (let i = 0; i < 30; i++) {
        const page = await browser.newPage()

        const connectionTime = await getConnectionTime(page, process.argv[2])


        // await page.close()
        console.log(connectionTime)

    }

    await browser.close()
}

run()
