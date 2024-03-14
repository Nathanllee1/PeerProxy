"use strict";
(() => {
  // serviceWorker/createPacket.ts
  var IDENTIFIER_LENGTH = 32;
  var TYPE_LEGNTH = 1;
  var CONTENT_LENGTH = 16;
  var FLAGS = 8;
  var HEADER_LENGTH = IDENTIFIER_LENGTH + TYPE_LEGNTH + CONTENT_LENGTH + FLAGS;
  function createFrame(identifier, messageType, payload, finalMessage, sequenceNum) {
    const headerSize = 11;
    let buffer = new ArrayBuffer(headerSize + payload.byteLength);
    let view = new DataView(buffer);
    view.setUint32(0, identifier);
    view.setUint32(4, sequenceNum);
    view.setUint16(8, payload.byteLength & 65535);
    let flags = (messageType === "HEADER" ? 0 : 1) | (finalMessage ? 1 : 0) << 1;
    view.setUint8(10, flags);
    let payloadView = new Uint8Array(buffer, headerSize);
    payloadView.set(new Uint8Array(payload));
    return buffer;
  }
  function createHeaderPacket(request, currentIdentifier) {
    let formattedHeaders = {};
    for (const header of request.headers.keys()) {
      formattedHeaders[header] = request.headers.get(header);
    }
    formattedHeaders["method"] = request.method;
    formattedHeaders["url"] = new URL(request.url).pathname;
    const encodedHeader = new TextEncoder().encode(JSON.stringify(formattedHeaders));
    const frame = createFrame(currentIdentifier, "HEADER", encodedHeader, true, 0);
    return frame;
  }
  var packetSizeBytes = 16 * 1024;
  var payloadSize = packetSizeBytes - 7;
  async function createPackets(request, currentIdentifier, cb) {
    cb(createHeaderPacket(request, currentIdentifier));
    if (!request.body) {
      return;
    }
    const reader = request.body?.getReader();
    if (!reader) {
      console.log(request);
      throw Error("Readable stream does not exist on reader");
    }
    let frameNum = 0;
    while (true) {
      const { done, value } = await reader?.read();
      if (done) {
        console.log("Last frame");
        const frame = createFrame(currentIdentifier, "BODY", new Uint8Array(), true, frameNum);
        cb(frame);
        break;
      }
      if (!value) {
        break;
      }
      let readerPosition = 0;
      while (readerPosition < value.byteLength) {
        const slicedArray = value.slice(readerPosition, readerPosition + payloadSize);
        let lastFrame = false;
        const frame = createFrame(currentIdentifier, "BODY", slicedArray, lastFrame, frameNum);
        frameNum++;
        cb(frame);
        readerPosition += payloadSize;
      }
    }
    return;
  }
  function parsePacket(buffer) {
    const headerSize = 11;
    let view = new DataView(buffer);
    let identifier = view.getUint32(0);
    let sequenceNum = view.getUint32(4);
    let payloadLength = view.getUint16(8);
    let flags = view.getUint8(10);
    const flagCodes = {
      0: [false, false],
      1: [false, true],
      2: [true, false],
      3: [true, true]
    };
    const [finalMessage, messageType] = flagCodes[flags];
    let payload = new Uint8Array(buffer, headerSize, payloadLength);
    return {
      identifier,
      sequenceNum,
      payload,
      messageType: messageType ? "HEADER" : "BODY",
      finalMessage
    };
  }

  // serviceWorker/streamHandler.ts
  var CustomStream = class {
    controller;
    stream;
    lastPacketFound = false;
    lastPacketNum = 0;
    packetsIngested = 0;
    outOfOrderPackets = {};
    currentPacketNum = 0;
    constructor() {
      this.stream = new ReadableStream({
        start: (controller) => {
          this.controller = controller;
        },
        pull: (controller) => {
        },
        cancel: (reason) => {
          console.log(`Stream cancelled, reason: ${reason}`);
        }
      });
    }
    // Method to add items to the stream
    addItem(item) {
      if (!this.controller) {
        console.error("Stream controller is not initialized.");
      }
      this.packetsIngested++;
      if (item.finalMessage) {
        console.log("Final message", item);
        this.lastPacketFound = true;
        this.lastPacketNum = item.sequenceNum;
      }
      if (item.sequenceNum == this.currentPacketNum) {
        console.log("enqueing", item);
        this.controller.enqueue(item.payload);
        this.currentPacketNum++;
      } else if (item.sequenceNum > this.currentPacketNum) {
        this.outOfOrderPackets[item.sequenceNum] = item.payload;
      }
      while (true) {
        if (!(this.currentPacketNum in this.outOfOrderPackets)) {
          break;
        }
        this.controller.enqueue(this.outOfOrderPackets[this.currentPacketNum]);
        delete this.outOfOrderPackets[this.currentPacketNum];
        this.currentPacketNum++;
      }
      if (this.packetsIngested === this.lastPacketNum + 1 && this.lastPacketFound) {
        console.log("Closing stream", item);
        this.closeStream();
      }
      return;
    }
    // Method to close the stream
    closeStream() {
      if (this.controller) {
        this.controller.close();
      }
    }
  };

  // serviceWorker/requestHandler.ts
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
    responses = {};
    currentIdentifier = 1;
    async makeRequest(request) {
      const clients = await self.clients.matchAll();
      await createPackets(request, this.currentIdentifier, (frame) => {
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
      const packet = parsePacket(reqObj);
      if (packet.messageType === "BODY") {
        this.responses[packet.identifier].addItem(packet);
        return;
      }
      const parsedHeaders = JSON.parse(new TextDecoder().decode(packet.payload));
      const headers = new Headers();
      let statusText = "200 OK";
      let status = 200;
      for (const headerKey in parsedHeaders) {
        if (headerKey === "status_code") {
          status = parseInt(parsedHeaders[headerKey][0]);
          continue;
        }
        if (headerKey === "status") {
          statusText = parsedHeaders[headerKey][0];
          continue;
        }
        headers.append(headerKey, parsedHeaders[headerKey].join(","));
      }
      const body = new CustomStream();
      this.responses[packet.identifier] = body;
      const response = new Response(body.stream, {
        headers,
        status,
        statusText
      });
      this.requests[packet.identifier].resolve(response);
    }
  };

  // serviceWorker/sw.ts
  var proxy = new HTTPProxy();
  self.addEventListener("install", (event) => {
    console.log("Service Worker installing.");
    event.waitUntil(
      // Perform installation steps
      self.skipWaiting()
      // Forces activation
    );
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
          peerConnected = false;
          lastClient = event.clientId;
          console.log("Detected restart");
          return fetch(event.request);
        }
        if (!peerConnected) {
          return fetch(event.request);
        }
        console.log(event.request);
        const body = await proxy.makeRequest(event.request);
        return body;
      })()
    );
  });
  var peerConnected = false;
  self.addEventListener("message", (event) => {
    if (event.data === "connected") {
      peerConnected = true;
      return;
    }
    if (event.data === "disconnected") {
      peerConnected = false;
      return;
    }
    proxy.handleRequest(event.data);
  });
})();
//# sourceMappingURL=sw.js.map
