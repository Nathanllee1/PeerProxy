(() => {
  // src/sw.ts
  var Deferred = class {
    promise;
    resolve;
    reject;
    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
  };
  var makeJSON = (obj) => {
    let props = [];
    for (let prop in obj) {
      props.push(prop);
    }
    return JSON.parse(JSON.stringify(obj, props));
  };
  var HTTPProxy = class {
    // a list of requests
    // { id: request }
    requests = {};
    async makeRequest(request) {
      const id = crypto.randomUUID();
      const clients = await self.clients.matchAll();
      if (!clients[0]) {
        return;
      }
      let req = makeJSON(request);
      req.url = new URL(req.url).pathname;
      clients[0].postMessage(JSON.stringify({
        request: req,
        id
      }));
      const prom = new Deferred();
      this.requests[id] = prom;
      return prom.promise;
    }
    handleRequest(reqObj) {
      console.log(this.requests, reqObj);
      this.requests[reqObj.id].resolve(reqObj.body);
    }
  };
  var proxy = new HTTPProxy();
  self.addEventListener("install", (event) => {
    console.log("Service Worker installing.");
  });
  self.addEventListener("activate", (event) => {
    console.log("Service Worker activated.");
  });
  var lastClient;
  self.addEventListener("fetch", async (event) => {
    event.respondWith(
      (async () => {
        if (event.clientId !== lastClient) {
          lastClient = event.clientId;
          console.log("Detected restart");
          return fetch(event.request);
        }
        if (!peerConnected) {
          return fetch(event.request);
        }
        console.log(new URL(event.request.url).origin);
        console.log(event.request);
        console.log(event.request.headers.get("Content-Type"));
        console.log(new URL(event.request.url).pathname);
        const timeout = new Promise((resolve, reject) => {
          setTimeout(async () => {
            console.log("Timed out");
            resolve(
              fetch(event.request)
            );
          }, 4e3);
        });
        const body = proxy.makeRequest(event.request);
        const res = Promise.race([timeout, body]);
        console.log(res);
        return res;
      })()
    );
  });
  var peerConnected = false;
  self.addEventListener("message", (event) => {
    console.log(`Message received: ${event.data}`);
    if (event.data === "connected") {
      peerConnected = true;
      return;
    }
    if (event.data === "disconnected") {
      peerConnected = false;
      return;
    }
  });
})();
