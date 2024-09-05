
async function fetchBuffer(sizeBytes) {
    return fetch(`/buffer?size=${sizeBytes}`)
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
        const csv = this.toCsv();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}


async function fetchSizes() {
    console.log('fetchSizes');

    const sizes = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 10 ** 8]
    const table = new DynamicTable('container', ['Size (bytes)', 'Time (ms)', 'mb/s'], 'Fetch Time Benchmark');

    for (const size of sizes) {
        console.log(`fetching ${size} bytes`);

        const start = performance.now()
        const res = await fetchBuffer(size)

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
        table.addRow([size, (end - start).toFixed(2), size / ((end - start) * 1000)])

        // 
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

    const latencies = [];



    for (let i = 0; i < trials; i++) {
        const latency = await getLatency();
        table.addRow([i, latency])

    }

    table.addAverageRow(1);

})


document.getElementById("fetchSizes")?.addEventListener("click", fetchSizes)

async function loadTest(trials, size, table) {
    // calculates request per second


    const start = performance.now()

    await Promise.all(Array(trials).fill(0).map(() => fetchBuffer(size)))

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

    // give me sizes evenly from 1 byte to 1mb in even increments
    const sizes = Array(10).fill(0).map((_, i) => ((10 ** 6) / 10) * i)

    // onst table = new DynamicTable('container', ['Size Response (bytes)', 'Time', 'RPS', 'Average Latency (ms)'], `Load Test Benchmark ${trials} trials`);

    for (const size of sizes) {
        await loadTest(trials, size, table)
    }
}

document.getElementById("loadtest")?.addEventListener("click", async () => {


    const bigTable = new DynamicTable('container', ['Trials', 'Size Response (bytes)', 'Time', 'Average Latency (ms)', 'Num Packets Transferred'], `Load Test Benchmark`);

    for (let i = 100; i <= 1000; i+=100) {
        await runTrials(i, bigTable)

    }


   

})

// fetchSizes();