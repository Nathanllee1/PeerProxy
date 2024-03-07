"use strict";
(() => {
  // serviceWorker/createPacket.ts
  var IDENTIFIER_LENGTH = 32;
  var TYPE_LEGNTH = 1;
  var CONTENT_LENGTH = 16;
  var FLAGS = 8;
  var HEADER_LENGTH = IDENTIFIER_LENGTH + TYPE_LEGNTH + CONTENT_LENGTH + FLAGS;
  function createFrame(identifier, messageType, payload, finalMessage) {
    const headerSize = 8;
    let buffer = new ArrayBuffer(headerSize + payload.byteLength);
    let view = new DataView(buffer);
    view.setUint32(0, identifier);
    view.setUint16(4, payload.byteLength & 65535);
    let flags = 1 & (messageType === "HEADER" ? 0 : 1) | (finalMessage ? 1 : 0);
    view.setUint8(6, flags);
    let payloadView = new Uint8Array(buffer, headerSize);
    payloadView.set(new Uint8Array(payload));
    return buffer;
  }
  function createHeaderPacket(headers, currentIdentifier) {
    let formattedHeaders = {};
    for (const header in headers.keys()) {
      formattedHeaders[header] = headers.get(header);
    }
    const encodedHeader = new TextEncoder().encode(JSON.stringify(formattedHeaders));
    const frame = createFrame(currentIdentifier, "HEADER", encodedHeader, true);
    return frame;
  }
  var packetSizeBytes = 16 * 1024;
  var payloadSize = packetSizeBytes - 7;
  async function createPackets(request, currentIdentifier, cb) {
    cb(createHeaderPacket(request.headers, currentIdentifier));
    if (!request.body) {
      return;
    }
    const reader = request.body?.getReader();
    if (!reader) {
      console.log(request);
      throw Error("Readable stream does not exist on reader");
    }
    while (true) {
      const { done, value } = await reader?.read();
      if (!value) {
        break;
      }
      let readerPosition = 0;
      while (readerPosition < value.byteLength) {
        const slicedArray = value.slice(readerPosition, readerPosition + payloadSize);
        let lastFrame = false;
        if (done && readerPosition + payloadSize > value.byteLength) {
          lastFrame = true;
        }
        const frame = createFrame(currentIdentifier, "BODY", slicedArray, lastFrame);
        cb(frame);
        readerPosition += payloadSize;
      }
      if (done) {
        return;
      }
    }
    return;
  }

  // serviceWorker/sw.ts
  var Deferred = class {
    promise;
    resolve = () => {
    };
    reject = () => {
    };
    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
  };
  var HTTPProxy = class {
    // a list of requests
    // { id: request }
    requests = {};
    currentIdentifier = 1;
    async makeRequest(request) {
      const clients = await self.clients.matchAll();
      createPackets(request, this.currentIdentifier, (frame) => {
        clients[0].postMessage(frame);
      });
      if (!clients[0]) {
        return new Response();
      }
      const prom = new Deferred();
      this.requests[this.currentIdentifier] = prom;
      this.currentIdentifier += 1;
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
  var lastClient = "";
  self.addEventListener("fetch", async (event) => {
    console.log(event);
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
//# sourceMappingURL=sw.js.map
