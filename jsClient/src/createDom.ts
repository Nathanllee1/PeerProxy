import { registration } from "./main";

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

  // cancel requests
  registration.active?.postMessage({
    type: "cancelRequests"
  });

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

export function enableClientSideRouting(document: Document = window.document) {
  document.body.addEventListener('click', async function (event) {
    const target = event.target as HTMLLinkElement;

    if (!target) {
      return;
    }

    if (target.tagName !== 'A' || !target.href) {
      return;
    }
    const origin = new URL(target.href).origin;

    if (origin !== window.location.origin) {
      return;
    }

    event.preventDefault(); // Prevent the link from triggering a page load


    var url = target.href;
    window.parent.history.pushState({ path: url }, '', url);

    await createDom(url); // Load content dynamically
    console.log("going to ", url);

    // Update the URL in the browser address bar
    try {
      console.log("Updated parent history to ", url);
    } catch (error) {
      console.error("Failed to update parent history:", error);
    }
    console.log("going to ", url);
  });


  window.parent.addEventListener('popstate', async function (event) {
    console.log("going back!", event.state, event.state?.path, window.location.pathname);
    // Handle browser navigation (forward/back)
    if (event.state && event.state.path) {
      await createDom(event.state.path);
      return;
    }

    await createDom(window.location.pathname);
  });

}
