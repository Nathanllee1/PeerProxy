export function log(text: string) {

    const root = document.getElementById("app")
    const newElement = document.createElement("div")
    console.log(text)
    newElement.textContent = text

    root?.append(
        newElement
    )

}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}