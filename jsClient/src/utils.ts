import { debug } from "./main"

export function log(text: string, ...args: any[]) {

    text = text + " " + args.join(" ")

    const root = document.getElementById("log")
    const newElement = document.createElement("div")

    if (debug) {
        console.log(text)

    }

    newElement.textContent = text

    root?.append(
        newElement
    )

}

export function displayError(text: string) {
    const root = document.getElementById("error")
    root!.textContent = text
}

export async function getCandidatePair(pc: RTCPeerConnection) {
    const stats = await pc.getStats();
    let selectedCandidatePair;

    stats.forEach(report => {
        if (report.type === 'transport') {
            // Find ID of selected candidate pair
            selectedCandidatePair = report.selectedCandidatePairId;
        }
    });

    if (selectedCandidatePair) {
        const candidatePair = stats.get(selectedCandidatePair);
        if (candidatePair) {
            return {
                local: stats.get(candidatePair.localCandidateId),
                remote: stats.get(candidatePair.remoteCandidateId)
            }
        }
    }

}


export async function logSelectedCandidatePair(pc: RTCPeerConnection) {
    const pair = await getCandidatePair(pc)
    if (pair) {
        log(`Local candidate: ${pair.local?.ip} Remote candidate: ${pair.remote?.ip}`)
    } 
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}


export class timer {

    timers: Record<string, number> = {}

    constructor() {
    }

    start(name: string) {
        this.timers[name] = performance.now()
    }

    end(name: string) {
        const start = this.timers[name]
        const end = performance.now()
        log(`${name} took ${end - start}ms`)

        return end - start
    }
}

export const timers = new timer()

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