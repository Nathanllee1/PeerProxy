export function log(text: string) {

    const root = document.getElementById("log")
    const newElement = document.createElement("div")
    console.log(text)
    newElement.textContent = text

    root?.append(
        newElement
    )

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
