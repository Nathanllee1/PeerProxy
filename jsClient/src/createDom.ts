import { log } from "./utils";


export async function createDom(pagePath: string) {


    log("Creating dom")

    const rootdoc = await fetch(pagePath)
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

    executeScripts(document.head);
    executeScripts(document.body);
}

function executeScripts(container: HTMLElement) {
    // Find all script elements
    const scripts = container.querySelectorAll("script");

    // For each script, replace it with a new script element to ensure execution
    scripts.forEach((oldScript) => {
        const newScript = document.createElement("script");
        // Copy script attributes (e.g., src, type)
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));

        if (oldScript.src) {
            // For external scripts, set the src attribute
            newScript.src = oldScript.src;
        } else {
            // For inline scripts, set the text content
            newScript.textContent = oldScript.textContent;
        }

        // Replace the old script with the new script to ensure it gets executed
        oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
}