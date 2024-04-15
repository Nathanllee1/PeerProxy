import { connect } from "./peer";
import { connectSW } from "./peer2";
import { getCandidatePair } from "./utils";

export async function test_connection(id: string) {

    const trials = 5;

    // do the same for connectSW
    const sw = new DynamicTable('results', ['Trial', 'Total Time (ms)', 'WS connection time', 'Candidate Type'], "Service Worker Connection");
    const registration = await navigator.serviceWorker.ready;

    for (let i = 0; i < trials; i++) {
        const start = performance.now();
        const { pc, stats } = await connectSW(id, registration);
        const end = performance.now();

        const pair = await getCandidatePair(pc);

        sw.addRow([i.toString(), (end - start).toFixed(2), stats.wsTime.toFixed(2), pair?.local?.candidateType || 'Unknown']);
    }

    sw.addAverageRow(1)

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
