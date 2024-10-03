
import { performance } from "perf_hooks"
const url = "http://localhost:3005";

const trials = 1000;

// 1 mb
const mb = 1024 * 1024;
const numMBs = 10;   
const bufferSize = mb * numMBs;

async function run() {
    for (let i = 0; i < trials; i ++ ) {

        const start = performance.now()
        await fetch(url + "/buffer?size=" + bufferSize);
        const end = performance.now();

        console.log(`${numMBs / ((end - start) / 1000 )} MBs`)

    
    }
}


run()