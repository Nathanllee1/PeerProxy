import { log } from "./utils";

export async function createDom(pagePath: string) {
    log("Creating dom")

    const rootdoc = await fetch(pagePath)

    if (!rootdoc.ok) {
        log("Server unavailable", rootdoc.statusText)

        // Make a new document to display the error
        const errorDoc = document.implementation.createHTMLDocument("Error")

        const errorContent = document.createElement("h3")
        errorContent.innerText = rootdoc.statusText

        errorDoc.body.appendChild(errorContent)
        
        document.body.innerHTML = errorDoc.body.innerHTML

        return
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

    // load css first
    await loadCSS(doc.head);

    const headScripts = document.head.querySelectorAll("script");
    const mappedHeadScripts = Array.from(headScripts).map(script => ({type: "head", script}))

    const bodyScripts = document.body.querySelectorAll("script");
    const mappedBodyScripts = Array.from(bodyScripts).map(script => ({type: "body", script}))

    await executeScripts([...mappedHeadScripts, ...mappedBodyScripts])

    // TODO: make sure async, defer, and module scripts are handled correctly
}

type scriptTypes = "head" | "body";

async function loadStylesheet(href: string) {
    return new Promise<HTMLLinkElement>((resolve, reject) => {
        const link = document.createElement('link');
        link.href = href;
        link.rel = 'stylesheet';
        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(`Stylesheet load error for ${href}`));
        document.head.appendChild(link);
    });
}

async function loadCSS(headContent: HTMLHeadElement) {
    const resources: Promise<HTMLLinkElement>[] = [];
    const stylesheets = headContent.querySelectorAll('link[rel="stylesheet"]');
    stylesheets.forEach(stylesheet => {
        resources.push(loadStylesheet(stylesheet.href));
    });
    await Promise.all(resources);
}


async function loadScripts(srcScript: HTMLScriptElement, type: scriptTypes) {
    return new Promise((resolve, reject) => {
        console.log("resolving", srcScript.src)
        const script = document.createElement("script");
        // script.src = srcScript.src

        Array.from(srcScript.attributes).forEach(attr => {
            script.setAttribute(attr.name, attr.value);
        });

        script.onload = () => resolve(script)
        script.onerror = () => reject(new Error(`Script load error for ${srcScript.src}`));

        console.log(srcScript, type)
        if (type === "head") {
            document.head.removeChild(srcScript)
            document.head.appendChild(script);
        } else {
            document.body.removeChild(srcScript)
            document.body.appendChild(script);
        }   
    })
}

async function executeScripts(scripts: {type: scriptTypes, script: HTMLScriptElement}[]) {
    let externalScripts = Array.from(scripts).filter(script => script.script.src);

    const loadedScripts = await Promise.all(
        externalScripts.map(script => loadScripts(script.script, script.type))
    );

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
        container.removeChild(script.script);

        container.appendChild(newScript);
    })
}