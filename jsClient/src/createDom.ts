import { enableClientSideRouting } from "./main";

export function setupIframe() {

    // Remove iframe if it exists
    const existingIframe = document.getElementById("webFrame");
    if (existingIframe) {
        existingIframe.remove();
    }

    return new Promise<HTMLIFrameElement>(async (resolve, reject) => {
        console.log("Creating iframe")
        const iframe = document.createElement("iframe");
        iframe.onload = () => resolve(iframe);

        iframe.id = "webFrame";
        iframe.width = "100%";
        iframe.height = "900";
        iframe.src = '/iframe.html';

        document.body.appendChild(iframe);
    });
}

export async function createDom(pagePath: string) {

    const iframe = await setupIframe();

    const contentDocument = iframe.contentDocument;

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
    if (!contentDocument?.documentElement) {
        throw new Error("No document element")
    }

    // create contextual fragment
    const headRange = contentDocument!.createRange()
    headRange.selectNode(contentDocument!.head)
    const headFragment = headRange.createContextualFragment(headContent)

    const bodyRange = contentDocument!.createRange()
    bodyRange.selectNode(contentDocument!.body)
    const bodyFragment = bodyRange.createContextualFragment(bodyContent)


    contentDocument.head.appendChild(headFragment)
    contentDocument.body.appendChild(bodyFragment)

    enableClientSideRouting(contentDocument)
}   