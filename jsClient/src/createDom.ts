import { enableClientSideRouting } from "./main";

export function setupIframe() {
    return new Promise<HTMLIFrameElement>(async (resolve, reject) => {
        console.log("Creating iframe")
        const iframe = document.getElementById("webFrame") as HTMLIFrameElement // || document.createElement("iframe");
        iframe.onload = () => resolve(iframe);

        // iframe.id = "webFrame";
        iframe.width = "100%";
        iframe.height = "900";
        // iframe.src = '/';

        document.body.appendChild(iframe);
    });
}

export async function createDom(pagePath: string, iframe: HTMLIFrameElement) {
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

    const bodyRange = iframe.contentDocument!.createRange()
    bodyRange.selectNode(iframe.contentDocument!.body)
    const bodyFragment = bodyRange.createContextualFragment(bodyContent)


    iframe.contentDocument.head.appendChild(headFragment)
    iframe.contentDocument.body.appendChild(bodyFragment)

    enableClientSideRouting(iframe.contentDocument)
}   