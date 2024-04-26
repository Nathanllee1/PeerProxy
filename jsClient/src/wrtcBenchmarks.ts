import { DataSet, Graph2d, Timeline } from "vis-timeline/standalone";
import { connect } from "./peer";
import { connectSW } from "./peer2";
import { getCandidatePair, log, sleep } from "./utils";
import { getId } from "./main";

import { createFrame } from "../serviceWorker/createPacket"

async function testSW(trials: number, id: string) {
    // do the same for connectSW
    const sw = new DynamicTable('results', ['Trial', 'Total Time (ms)', 'WS connection time', 'Candidate Type'], "Service Worker Connection");
    const registration = await navigator.serviceWorker.ready;

    for (let i = 0; i < trials; i++) {
        const start = performance.now();
        const { pc, stats } = await connectSW(id, registration);
        const end = performance.now();
        const pair = await getCandidatePair(pc);
        pc.close()

        sw.addRow([i.toString(), (end - start).toFixed(2), stats.wsTime.toFixed(2), pair?.local?.candidateType || 'Unknown']);
    }

    sw.addAverageRow(1)
}

async function testNormal(trials: number, id: string) {
    const original = new DynamicTable('results', ['Trial', 'Total Time (ms)', 'WS connection time', 'Candidate Type'], "Original Connection");

    for (let i = 0; i < trials; i++) {
        const start = performance.now();
        const { pc, stats } = await connect(id)

        const end = performance.now();

        // Get connection type of pc eg. srflx, relay, prflx
        const pair = await getCandidatePair(pc);

        original.addRow([i.toString(), (end - start).toFixed(2), stats.wsTime.toFixed(2), pair?.local?.candidateType || 'Unknown']);
    }

    original.addAverageRow(1);
}

async function testCached(trials: number, id: string) {
    const swCached = new DynamicTable('results', ['Trial', 'Total Time (ms)', 'WS connection time', 'Candidate Type'], "Service Worker Connection (cached)");
    const registrationCached = await navigator.serviceWorker.ready;

    for (let i = 0; i < trials; i++) {
        const start = performance.now();
        const { pc, stats } = await connectSW(id, registrationCached, true);
        const end = performance.now();

        const pair = await getCandidatePair(pc);
        pc.close()
        swCached.addRow([i.toString(), (end - start).toFixed(2), stats.wsTime.toFixed(2), pair?.local?.candidateType || 'Unknown']);
    }

    swCached.addAverageRow(1)

}

export async function test_connection(id: string) {

    const trials = 5;
    await testSW(trials, id)

    await testCached(trials, id)

}


class DynamicTable {
    private table: HTMLTableElement;
    private titleElement: HTMLElement;
    private numRows: number = 0;

    constructor(containerId: string, headers: string[], title: string) {
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
        const headerRow: HTMLTableRowElement = this.table.insertRow(-1);
        headers.forEach((headerText: string) => {
            let headerCell = document.createElement('th');
            headerCell.textContent = headerText;
            headerCell.style.padding = '8px';
            headerCell.style.border = '1px solid #ddd';
            headerCell.style.backgroundColor = '#f2f2f2';
            headerRow.appendChild(headerCell);
        });

        // Find the container and append the title and table to it
        const container: HTMLElement | null = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container ID not found in the DOM');
        }
        container.appendChild(this.titleElement);
        container.appendChild(this.table);
    }

    addRow(data: string[]): void {
        this.numRows++;
        const row: HTMLTableRowElement = this.table.insertRow(-1);
        data.forEach((cellData: string) => {
            let cell = row.insertCell(-1);
            cell.textContent = cellData;
            cell.style.padding = '8px';
            cell.style.border = '1px solid #ddd';
        });
    }

    addAverageRow(columnIndex: number): void {
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


export async function createTimeline(stats: DataSet<any>) {

    const groups = new DataSet([
        { content: "Connection", id: "Connection", style: "color: #1a237e; background-color: #e8eaf6;" },
        { content: "Client Ice Candidate", id: "Client Ice Candidate", style: "color: #2e7d32; background-color: #e8f5e9;" },
        { content: "Server Ice Candidate", id: "Server Ice Candidate", style: "color: #bf360c; background-color: #fbe9e7;" },
        { content: "SDP Exchange", id: "SDP Exchange", style: "color: #6a1b9a; background-color: #ede7f6;" },
        { content: "Signaling", id: "Signaling", style: "color: #006064; background-color: #e0f7fa;" }
    ])

    const timelineContainer = document.getElementById("timeline")
    const timeline = new Timeline(timelineContainer!, stats)

    timeline.setGroups(groups)
}

document.getElementById("connectionTest")?.addEventListener("click", async () => {

    await test_connection(getId())
})





document.getElementById("connectionSpeed")?.addEventListener("click", async () => {

    const { pc, dc } = await connect(getId());
    const TEST_LENGTH = 5000

    const speeds = new DataSet();
    new Graph2d(document.getElementById("speedGraph")!, speeds, {
        start: new Date().getTime() - 2000,
        end: new Date().getTime() + TEST_LENGTH + 2000
    })

    const testPacket = createFrame(0, 'HEADER', new Uint8Array(1024 * 15), true, 0, true)

    let previousBytesSent = 0
    const MONITORING_RATE = 150
    const monitoringInvl = setInterval(async () => {
        const stats = await pc.getStats()

        stats.forEach(report => {
            if (report.type !== 'data-channel') {
                return
            }
            const bytesSent = report.bytesSent;
            const throughput = (bytesSent - previousBytesSent) * 8 / MONITORING_RATE / 1000; // bits per second
            previousBytesSent = bytesSent;

            speeds.add({
                x: new Date(),
                y: throughput
            })
        })
    }, MONITORING_RATE)

    await sleep(500)

    dc.onbufferedamountlow = () => {
        dc.send(testPacket)
    }

    const sendInvl = setInterval(() => {
        dc.send(testPacket)
    })


    setTimeout(async () => {
        clearInterval(sendInvl)

        await sleep(1000)
        clearInterval(monitoringInvl)
    }, TEST_LENGTH)
});

async function getLatency() {
    const res = await fetch("/latency", {
        body: new Date().getTime().toString(),
        method: "POST"
    })

    const time =parseInt( await res.text());

    const latency = new Date().getTime() - time

    return latency
}


document.getElementById("latency")?.addEventListener("click", async () => {

    const trials = 1000;

    const latencies = new DataSet();

    new Graph2d(document.getElementById("latencyGraph")!, latencies, {
        start: new Date().getTime() - 2000,
        end: new Date().getTime() + 20000
    })

    for (let i = 0; i < trials; i++) {
        const latency = await getLatency();
        latencies.add({
            x: new Date(),
            y: latency
        })

    }

})