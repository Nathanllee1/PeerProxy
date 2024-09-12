import { spawn } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';
import { setTimeout } from 'timers/promises';
import os from 'os';
import process from 'process';
import { getFormattedDateTime } from '../processTest.mjs';
import pidtree from 'pidtree';
import pidusage from 'pidusage';

// Main function to monitor the process
async function monitorProcess(command, args, interval = 1000, outputFile = `logs/${getFormattedDateTime()}.txt`) {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    console.log(`Monitoring process ${child.pid}...`);

    writeFileSync(outputFile, 'timestamp,totalMemory,totalCpuPercentage,processCount\n');

    while (true) {
        await setTimeout(interval);

        try {
            const pids = await pidtree(child.pid, { root: true });
            const stats = await pidusage(pids);

            let totalMemory = 0;
            let totalCpuPercentage = 0;
            let processCount = 0;

            for (const pid in stats) {
                totalMemory += stats[pid].memory;
                totalCpuPercentage += stats[pid].cpu;
                processCount++;
            }

            const logData = `${new Date().toISOString()},${totalMemory},${totalCpuPercentage.toFixed(2)},${processCount}\n`;
            appendFileSync(outputFile, logData);

            // console.log(`Total CPU: ${totalCpuPercentage.toFixed(2)}%, Total Memory: ${(totalMemory / 1024 / 1024).toFixed(2)} MB, Process Count: ${processCount}`);

        } catch (error) {
            console.error('Error monitoring processes:', error);
            break;
        }
    }
}

// Get command line arguments
const [, , script, ...scriptArgs] = process.argv;

if (!script) {
    console.error('Usage: node test.mjs <script> <args>');
    process.exit(1);
}

// Start monitoring the specified script
monitorProcess(script, scriptArgs);
