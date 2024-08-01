
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
        table.addRow([size, (end - start).toFixed(2), size /( (end - start) * 1000)])

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

    const latencies =[];

    

    for (let i = 0; i < trials; i++) {
        const latency = await getLatency();
        table.addRow([i, latency])

    }

    table.addAverageRow(1);

})

fetchSizes()