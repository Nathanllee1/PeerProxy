
import { performance } from "perf_hooks"
const url = "http://localhost:3005";

const trials = 1000;

// 1 mb
const mb = 1024 * 1024;
const numMBs = 5;   
const bufferSize = mb * numMBs;

async function run() {
    for (let i = 0; i < trials; i ++ ) {

        const start = performance.now()
        const res = await fetch(url + "/buffer?size=" + bufferSize);

        // consume res
        const buffer = await res.arrayBuffer();

        const size = buffer.byteLength / mb;
        console.log(size)

        const end = performance.now();

        console.log(`${size / ((end - start) / 1000 )} MBs`)
    }
}

async function concurrentRun() {
    const concurrentBlock = 10

    for (let i = 0; i < trials; i += concurrentBlock) {

        await Promise.all(Array(concurrentBlock).fill(0).map(async (_, j) => {
            const start = performance.now()
            await fetch(url + "/buffer?size=" + bufferSize);
            const end = performance.now();
    
            console.log(`${numMBs / ((end - start) / 1000 )} MBs`)
        }))

    }
}

run()