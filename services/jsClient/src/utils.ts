export function log(text: string | undefined) {

    const root = document.getElementById("app")
    const newElement = document.createElement("div")
    console.log(text)
    newElement.textContent = JSON.stringify(text, undefined, 2)

    root?.append(
        newElement
    )

}