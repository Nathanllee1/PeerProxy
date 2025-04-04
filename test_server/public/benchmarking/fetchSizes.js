let fetching = true;


async function fetchBuffer(sizeBytes) {
    return fetch(`/buffer?size=${sizeBytes}`, { cache: 'no-store' })
}


let submitId = 0
async function submitBuffer(sizeBytes) {

    const buffer = new Uint8Array(sizeBytes);
    buffer.fill(65); // ASCII value of 'A'    
    submitId += 1

    return fetchWithTimeout(`/submit?id=${submitId}`, {
        method: "POST",
        body: buffer
    })

}

async function transferBuffer(sizeBytes) {
    if (fetching) {
        return fetchBuffer(sizeBytes);
    } else {
        return submitBuffer(sizeBytes);
    }
}


let autoDownload = true;

function getFormattedDateTime() {
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

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


class DynamicTable {
    table;
    titleElement;
    numRows = 0;

    constructor(containerId, headers, title) {
        // Create and style the title for the table
        this.titleElement = document.createElement('h2');
        this.titleElement.textContent = title;
        this.titleElement.style.textAlign = 'center';

        // add a button to download the csv
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download CSV';
        downloadButton.style.margin = '20px auto';
        downloadButton.style.display = 'block';
        downloadButton.id = 'downloadCSV'
        downloadButton.addEventListener('click', () => {
            this.downloadCsv('benchmark.csv');
        });
        this.titleElement.appendChild(downloadButton);

        // Create the table and apply basic styles
        this.table = document.createElement('table');
        this.table.style.width = '80%';
        this.table.style.margin = '20px auto';
        this.table.style.borderCollapse = 'collapse';
        this.table.setAttribute('border', '1');

        // Styling for headers
        const headerRow = this.table.insertRow(-1);
        headers.forEach((headerText) => {
            let headerCell = document.createElement('th');
            headerCell.textContent = headerText;
            headerCell.style.padding = '8px';
            headerCell.style.border = '1px solid #ddd';
            headerCell.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(headerCell);
        });

        // Find the container and append the title and table to it
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container ID not found in the DOM');
        }
        container.appendChild(this.titleElement);
        container.appendChild(this.table);
    }

    addRow(data) {
        this.numRows++;
        const row = this.table.insertRow(-1);
        data.forEach((cellData) => {
            let cell = row.insertCell(-1);
            cell.textContent = cellData;
            cell.style.padding = '8px';
            cell.style.border = '1px solid #ddd';
        });
    }

    addAverageRow(columnIndex) {
        if (this.numRows === 0 || this.table.rows[1].cells[columnIndex].textContent === undefined) {
            console.error('Invalid column index or no rows to calculate averages from.');
            return;
        }

        // Calculate average
        let sum = 0;
        for (let i = 1; i < this.table.rows.length; i++) {
            sum += parseFloat(this.table.rows[i].cells[columnIndex].textContent || '0');
        }
        let average = sum / this.numRows;

        // Create average row
        const row = this.table.insertRow(-1);
        row.insertCell(-1).textContent = 'Average'; // Label cell
        for (let i = 0; i < columnIndex; i++) {
            row.insertCell(-1); // Empty cells
        }
        let avgCell = row.insertCell(-1);
        avgCell.textContent = average.toFixed(2);
        avgCell.style.fontWeight = 'bold';
        avgCell.style.backgroundColor = '#e8e8e8';
    }

    toCsv() {
        let csv = '';
        for (let i = 0; i < this.table.rows.length; i++) {
            let row = this.table.rows[i];
            for (let j = 0; j < row.cells.length; j++) {
                csv += row.cells[j].textContent + ',';
            }
            csv = csv.slice(0, -1); // Remove trailing comma
            csv += '\n';
        }
        return csv;
    }

    downloadCsv(filename) {

        console.log("Downloading csv", filename)
        const csv = this.toCsv();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getFormattedDateTime()}-${filename}`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function makeExponentialSizes(numSizes, maxPower = 8) {

    const increment = maxPower / numSizes

    let sizes = []

    for (let i = 0; i < numSizes; i++) {

        sizes.push((10 ** (i * increment)).toFixed(0))

    }

    return sizes

}

function makeLinearSizes(numSizes, maxBytes = 10 ** 7) {

    const increment = maxBytes / numSizes

    let sizes = []

    for (let i = 0; i < numSizes; i++) {

        sizes.push((i * increment).toFixed(0))

    }

    return sizes

}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function doTest(table, size) {
    console.log(`fetching ${size} bytes`);

    const start = performance.now()

    // error handling with backoff
    let res;
    let backoff = 50;
    while (true) {
        try {
            res = await transferBuffer(size)
            break
        } catch (e) {
            console.error(e)
            await sleep(backoff)
            backoff *= 2
        }
    }

    // read buffer until end
    const reader = res.body.getReader()
    let bytesRead = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }
        bytesRead += value.byteLength
    }

    const end = performance.now()

    console.log(`fetched ${size} bytes in ${end - start}ms`);

    // make table
    table.addRow([size, formatBytes(size), (end - start).toFixed(2), size / ((end - start) * 1000)])
}

async function testThroughput() {

    const sizes = makeLinearSizes(100, 5 * 10 ** 6)
    const table = new DynamicTable('container', ['Size (bytes)', 'Size (readable)', 'Time (ms)', 'mb/s'], 'Fetch Time Benchmark');

    const trials = 5;

    for (const size of sizes) {

        for (let i = 0; i < trials; i++) {

            await doTest(table, size)

        }


    }

    if (autoDownload) {
        table.downloadCsv('throughput.csv');
    }
}

async function getLatency() {
    const res = await fetch("/latency", {
        body: new Date().getTime().toString(),
        method: "POST"
    })

    const time = parseInt(await res.text());

    const latency = new Date().getTime() - time

    return latency
}

document.getElementById("latency")?.addEventListener("click", async () => {

    const trials = 15;
    const table = new DynamicTable('container', ['Time', 'Latency (ms)'], 'Latency Benchmark');

    for (let i = 0; i < trials; i++) {
        const latency = await getLatency();
        table.addRow([i, latency])

        console.log(latency)

    }

    console.log(autoDownload)

    if (autoDownload) {
        table.downloadCsv('singleRequest.csv');
    }

    table.addAverageRow(1);

})


document.getElementById("fetchSizes")?.addEventListener("click", testThroughput)

document.getElementById("sequentialLatency")?.addEventListener("click", sequentialLatency)
async function sequentialLatency() {

    const table = new DynamicTable('container', ['Trials', 'Size Response (bytes)', 'Time', 'Average Latency (ms)'], `Sequential Latency Benchmark`);

    const sizes = makeExponentialSizes(10, 6).slice(1)

    for (let i = 100; i <= 400; i += 100) {
        for (const size of sizes) {

            const start = performance.now()
            
            for (let j = 0; j < i; j++) {
                await transferBuffer(size)
            }


            const end = performance.now()

            const time = end - start

            table.addRow([i, size, time, time / i])

        }

    }


}


async function loadTest(trials, size, table) {
    // calculates request per second


    const start = performance.now()

    await Promise.all(Array(trials).fill(0).map(() => transferBuffer(size)))

    const end = performance.now()
    const time = end - start

    const latency = time / trials

    // 60kb
    const packetSize = 60 * 1024
    const numPackets = size / packetSize

    table.addRow([trials, size, time, latency, numPackets])
}



async function runTrials(trials, table) {
    // const sizes = [1, 10, 100, 1000, 10000, 100000]

    // const sizes = Array(5).fill(0).map((_, i) => ((10 ** 6) / 10) * i)
    const sizes = makeExponentialSizes(10, 10) // .slice(3)
    // onst table = new DynamicTable('container', ['Size Response (bytes)', 'Time', 'RPS', 'Average Latency (ms)'], `Load Test Benchmark ${trials} trials`);

    for (const size of sizes) {
        await loadTest(trials, size, table)
    }
}

document.getElementById("loadtest")?.addEventListener("click", async () => {

    console.log("Starting load test", new Date().toISOString())
    const bigTable = new DynamicTable('container', ['Trials', 'Size Response (bytes)', 'Time', 'Average Latency (ms)', 'Num Packets Transferred'], `Load Test Benchmark`);

    for (let i = 1; i <= 100; i += 10) {
        await runTrials(i, bigTable)

    }

    console.log("Finished load test", new Date().toISOString())

    if (autoDownload) {
        bigTable.downloadCsv('latency.csv');
    }


})


function automaticTest() {

    // get search parameters "test"
    const urlParams = new URLSearchParams(window.location.search);
    const test = urlParams.get('test');

    const upload = urlParams.get('upload');

    fetching = upload === null



    console.log(test)

    if (!test) {
        autoDownload = false;
        return
    }

    if (test === "single_latency") {
        document.getElementById("latency").click()
    } else if (test === "throughput") {
        testThroughput()
    } else if (test === "latency") {
        document.getElementById("loadtest").click()
    }

}

// fetchSizes();

automaticTest()


// add a checkbox that lets you select fetching or uploading
document.getElementById("fetching").addEventListener("change", (e) => {

    fetching = e.target.checked

})



// submit with timeout
function fetchWithTimeout(url, options, timeout = 1000) {
    const fetchPromise = fetch(url, options).then(res => {
        if (res.ok) {
            return res;
        } else {
            return Promise.reject(new Error(`HTTP error: ${res.status}`));
        }
    });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
    );

    return Promise.race([fetchPromise, timeoutPromise]);
}




document.getElementById("unique100")?.addEventListener("click", async () => {

    const ids = Array(100).fill(0).map((_, i) => i)

    const result = await Promise.allSettled(ids.map((id) => {

        return fetchWithTimeout(`/submit?id=${id}`, {
            method: "POST",

        })

    }))

    console.log(result)

})


async function sequentialPosts(numPosts, size) {

    const ids = Array(numPosts).fill(0).map((_, i) => i)

    for (const id of ids) {
        try {
            await fetch(`/submit?id=${id}`, {
                method: "POST",
                body: new Uint8Array(size).fill(65)
    
            })


        } catch (e) {
            console.error(e)
            throw (e)
        }

    }

    console.log("Done")
}

document.getElementById("unique100sequential")?.addEventListener("click", async () => {

    const ids = Array(100).fill(0).map((_, i) => i)

    for (const id of ids) {
        try {
            await fetch(`/submit?id=${id}`, {
                method: "POST",
                body: new Uint8Array(10 ** 6).fill(65)
    
            })


        } catch (e) {
            console.error(e)
            throw (e)
        }

    }

    console.log("Done")
})


let id = 0

document.getElementById('submit')?.addEventListener('click', async () => {

    id += 1

    await fetch(`/submit?id=${id}`, {
        method: "POST",
        body: new Uint8Array(10 ** 6).fill(65)
    })
})
