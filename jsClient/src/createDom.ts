import { log } from "./utils";


export async function createDom(pagePath: string) {


    log("Creating dom")

    const rootdoc = await fetch(pagePath)

    if (!rootdoc.ok) {
        log("Server unavailable")
    }

    const content = await rootdoc.text()

    // Assuming `content` holds the HTML content of the root document
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Extract the <head> and <body> content from the fetched document
    const newHeadContent = doc.head.innerHTML;
    const newBodyContent = doc.body.innerHTML;

    // Replace the current <head> content
    document.head.innerHTML = newHeadContent;

    // Replace the current <body> content
    document.body.innerHTML = newBodyContent;

    const headScripts = document.head.querySelectorAll("script");
    const mappedHeadScripts = Array.from(headScripts).map(script => ({type: "head", script}))

    const bodyScripts = document.body.querySelectorAll("script");
    const mappedBodyScripts = Array.from(bodyScripts).map(script => ({type: "body", script}))

    await executeScripts([...mappedHeadScripts, ...mappedBodyScripts])

    // TODO: make sure async, defer, and module scripts are handled correctly
}

async function loadScripts(src: string) {
    return new Promise((resolve, reject) => {
        console.log("resolving", src)
        const script = document.createElement("script");
        script.src = src

        script.onload = () => resolve(script)
        script.onerror = () => reject(new Error(`Script load error for ${src}`));
        document.head.appendChild(script);

    })
}

async function executeScripts(scripts: {type: string, script: HTMLScriptElement}[]) {
    let externalScripts = Array.from(scripts).filter(script => script.script.src);

    await Promise.all(externalScripts.map(script => loadScripts(script.script.src)));
    console.log("Loaded external scripts")

    // mount non-external scripts
    const inlineScripts = Array.from(scripts).filter(script => !script.script.src)
    inlineScripts.forEach(script => {
        const newScript = document.createElement("script");

        Array.from(script.script.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });
        
        newScript.textContent = script.script.textContent;

        const container = script.type === "head" ? document.head : document.body;

        container.appendChild(newScript);
    })
}