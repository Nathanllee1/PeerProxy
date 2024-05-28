import { setupIframe } from "./createDom";
import { enableClientSideRouting } from "./main";
import { sleep } from "./utils";

function setInnerHTML(elm: HTMLElement, html: string) {


    elm.innerHTML = html;

    Array.from(elm.querySelectorAll("script"))
        .forEach(oldScriptEl => {

            console.log(oldScriptEl)
            const newScriptEl = document.createElement("script");

            Array.from(oldScriptEl.attributes).forEach(attr => {
                newScriptEl.setAttribute(attr.name, attr.value)
            });

            const scriptText = document.createTextNode(oldScriptEl.innerHTML);
            newScriptEl.appendChild(scriptText);

            oldScriptEl.parentNode!.replaceChild(newScriptEl, oldScriptEl);
        });
}

export async function createDom2(pagePath: string) {

    const iframe = await setupIframe()

    const fetchedPage = await fetch(pagePath, {
        // headers that set x-root-page
        headers: {
            "x-root-page": "true"
        }
    })

    const content = await fetchedPage.text();
    

    const parser = new DOMParser();
    const fullDom = parser.parseFromString(content, "text/html");

    // convert the head into a string
    const headContent = fullDom.querySelector('head')!.innerHTML;
    const bodyContent = fullDom.querySelector('body')!.innerHTML;

    // Replace iframe content with doc
    if (!iframe.contentDocument?.documentElement) {
        throw new Error("No document element")
    }

    // create contextual fragment
    const headRange = iframe.contentDocument!.createRange()
    headRange.selectNode(iframe.contentDocument!.head)
    const headFragment = headRange.createContextualFragment(headContent)
    console.log(headFragment)
    const bodyRange = iframe.contentDocument!.createRange()
    bodyRange.selectNode(iframe.contentDocument!.body)
    const bodyFragment = bodyRange.createContextualFragment(bodyContent)


    iframe.contentDocument.head.appendChild(headFragment)
    iframe.contentDocument.body.appendChild(bodyFragment)

    // replace content in iframe
    // iframe.contentDocument.documentElement.appendChild(fragment)

    enableClientSideRouting(iframe.contentDocument)

    /*
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Add a script to the front of head
    const script = iframe.contentWindow?.document.createElement("script")!
    script.src = "/iframeScript.js"
    iframe.contentWindow?.document.head.prepend(script)


    // Replace iframe content with doc
    if (!iframe.contentWindow?.document.documentElement) {
        throw new Error("No document element")
    }

    // const doc = iframe.contentWindow.document.open()
    setInnerHTML(iframe.contentWindow.document.documentElement, doc.documentElement.innerHTML)
    enableClientSideRouting(iframe.contentWindow.document)
    // iframe.contentWindow.document.documentElement.innerHTML = doc.documentElement.innerHTML
    
    */
}   