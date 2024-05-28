import { enableClientSideRouting, enableIframe } from "./main";
import { log, sleep } from "./utils";

export function setupIframe() {
    return new Promise<HTMLIFrameElement>(async (resolve, reject) => {
        console.log("Creating dynamic iframe")
        // await sleep(1000)
        const iframe = document.getElementById("webFrame") as HTMLIFrameElement // || document.createElement("iframe");
        iframe.onload = () => resolve(iframe);

        // iframe.id = "webFrame";
        iframe.width = "100%";
        iframe.height = "900";
        // iframe.src = '/';

        document.body.appendChild(iframe);
    });
}

export async function createDom(pagePath: string, rootDoc: Document = window.document) {
    log("Creating dom", pagePath)
    // await sleep(2000)
    if (enableIframe) {
        // dynamically create an iframe   <iframe id="webFrame" width="700px" height="500px" src="iframe.html"></iframe>

        // remove previous iframe if it exists
        /*
        const previousIframe = rootDoc.getElementById("webFrame");
        if (previousIframe) {
            previousIframe.remove();
        }
        */

        const iframe = await setupIframe();
        /*
        const iframePage = await fetch(pagePath, {
            headers: {
                "x-root-page": "true"
            }
        })

        const pageContent = await iframePage.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(pageContent, "text/html");

        const base = doc.createElement('base');
        base.href = pagePath;
        const head = doc.querySelector('head');
        if (head) {
            head.insertBefore(base, head.firstChild);
        } else {
            const newHead = doc.createElement('head');
            newHead.appendChild(base);
            doc.documentElement.insertBefore(newHead, doc.body);
        }

        // Conver doc back into string
        const updatedPageContent = new XMLSerializer().serializeToString(doc);

        const blob = new Blob([updatedPageContent], { type: "text/html" })
        const url = URL.createObjectURL(blob)

        iframe.src = url;
        */
        rootDoc = iframe.contentDocument as Document;

        // iframe.srcdoc = await iframePage.text();
        
        enableClientSideRouting(iframe.contentDocument as Document);

        console.log(iframe)

        // return

    }

    const fetchedPage = await fetch(pagePath, {
        // headers that set x-root-page
        headers: {
            "x-root-page": "true"
        }
    })

    if (!fetchedPage.ok) {
        log("Server unavailable", fetchedPage.statusText)

        // Make a new document to display the error
        const errorDoc = rootDoc.implementation.createHTMLDocument("Error")

        const errorContent = rootDoc.createElement("h3")
        errorContent.innerText = fetchedPage.statusText

        errorDoc.body.appendChild(errorContent)

        rootDoc.body.innerHTML = errorDoc.body.innerHTML

        return
    }

    const content = await fetchedPage.text()

    // Assuming `content` holds the HTML content of the root document
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Extract the <head> and <body> content from the fetched document
    const newHeadContent = doc.head.innerHTML;
    const newBodyContent = doc.body.innerHTML;

    // Replace the current <head> content
    // Create if doesn't exist
    if (!rootDoc.head) {
        const head = rootDoc.createElement("head");
        rootDoc.documentElement.appendChild(head);
    }
    rootDoc.head.innerHTML = newHeadContent;

    // Replace the current <body> content
    // Create if doesn't exist
    if (!rootDoc.body) {
        const body = rootDoc.createElement("body");
        rootDoc.documentElement.appendChild(body);
    }
    rootDoc.body.innerHTML = newBodyContent;

    console.log(rootDoc)

    // load css first
    await loadCSS(doc.head, rootDoc);

    const headScripts = rootDoc.head.querySelectorAll("script");
    const mappedHeadScripts = Array.from(headScripts).map(script => ({ type: "head", script }))

    const bodyScripts = rootDoc.body.querySelectorAll("script");
    const mappedBodyScripts = Array.from(bodyScripts).map(script => ({ type: "body", script }))

    await executeScripts([...mappedHeadScripts, ...mappedBodyScripts], rootDoc)

    // TODO: make sure async, defer, and module scripts are handled correctly
}

type scriptTypes = "head" | "body";

async function loadStylesheet(href: string, rootDoc: Document) {
    return new Promise<HTMLLinkElement>((resolve, reject) => {
        const link = rootDoc.createElement('link');
        link.href = href;
        link.rel = 'stylesheet';
        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error(`Stylesheet load error for ${href}`));
        rootDoc.head.appendChild(link);
    });
}

async function loadCSS(headContent: HTMLHeadElement, rootDoc: Document) {
    const resources: Promise<HTMLLinkElement>[] = [];
    const stylesheets = headContent.querySelectorAll('link[rel="stylesheet"]');

    stylesheets.forEach(stylesheet => {
        resources.push(loadStylesheet(stylesheet.href, rootDoc));
    });
    await Promise.all(resources);
}

type passedScript = { type: scriptTypes, script: HTMLScriptElement }

async function loadScripts(srcScript: passedScript, rootDoc: Document) {
    return new Promise((resolve, reject) => {
        console.log("resolving", srcScript.script.src)
        const script = rootDoc.createElement("script");

        Array.from(srcScript.script.attributes).forEach(attr => {
            script.setAttribute(attr.name, attr.value);
        });

        script.textContent = srcScript.script.textContent;

        script.onload = () => resolve(script)
        script.onerror = () => console.error((`Script load error for ${srcScript.script.src}`));

        // console.log(srcScript, srcScript.type)
        if (srcScript.type === "head") {
            rootDoc.head.removeChild(srcScript.script)
            rootDoc.head.appendChild(script);
        } else {
            rootDoc.body.removeChild(srcScript.script)
            rootDoc.body.appendChild(script);
        }
    })
}


async function executeScripts(scripts: passedScript[], rootDoc: Document) {

    const asyncScripts = scripts.filter(script => script.script.async);
    const deferScripts = scripts.filter(script => script.script.defer);
    const moduleScripts = scripts.filter(script => script.script.type === "module");
    const normalScripts = scripts.filter(script => !script.script.async && !script.script.defer && script.script.type !== "module");

    console.log({normalScripts, asyncScripts, deferScripts, moduleScripts})

    // Execute scripts based on their type
    await Promise.all(asyncScripts.map(script => loadScripts(script, rootDoc)));
    await Promise.all(moduleScripts.map(script => loadScripts(script, rootDoc)));

    console.log("Loaded external scripts")

    // mount non-external scripts
    const inlineScripts = Array.from(scripts).filter(script => !script.script.src)
    inlineScripts.forEach(script => {
        const newScript = rootDoc.createElement("script");

        Array.from(script.script.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
        });

        newScript.textContent = script.script.textContent;

        const container = script.type === "head" ? rootDoc.head : rootDoc.body;
        container.removeChild(script.script);

        container.appendChild(newScript);
    })

    await Promise.all(deferScripts.map(script => loadScripts(script, rootDoc)));

    // await Promise.all(normalScripts.map(script => loadScripts(script, rootDoc))); // These are synchronous

    for (const script of normalScripts) {
        await loadScripts(script, rootDoc)
    }

}
