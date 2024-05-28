"use strict";
(() => {
  // serviceWorker/createPacket.ts
  var IDENTIFIER_LENGTH = 32;
  var TYPE_LEGNTH = 1;
  var CONTENT_LENGTH = 16;
  var FLAGS = 8;
  var HEADER_LENGTH = IDENTIFIER_LENGTH + TYPE_LEGNTH + CONTENT_LENGTH + FLAGS;
  function createFrame(identifier, messageType, payload, finalMessage, sequenceNum, heartbeat = false) {
    const headerSize = 11;
    let buffer = new ArrayBuffer(headerSize + payload.byteLength);
    let view = new DataView(buffer);
    view.setUint32(0, identifier);
    view.setUint32(4, sequenceNum);
    view.setUint16(8, payload.byteLength & 65535);
    let flags = (messageType === "HEADER" ? 0 : 1) | (finalMessage ? 1 : 0) << 1 | (heartbeat ? 1 : 0) << 2;
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
      const endFrame = createFrame(currentIdentifier, "BODY", new Uint8Array(), true, 0);
      cb(endFrame);
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
    cancelled = false;
    constructor() {
      this.stream = new ReadableStream({
        start: (controller) => {
          this.controller = controller;
        },
        pull: (controller) => {
        },
        cancel: (reason) => {
          if (!this.stream.locked && this.controller) {
            this.controller.close();
          }
          console.log(`Stream cancelled, reason: ${reason}`);
          this.outOfOrderPackets = {};
          this.cancelled = true;
        }
      });
    }
    // Method to add items to the stream
    addItem(item) {
      if (!this.controller) {
        console.error("Stream controller is not initialized.");
      }
      if (this.cancelled) {
        return;
      }
      this.packetsIngested++;
      if (item.finalMessage) {
        this.lastPacketFound = true;
        this.lastPacketNum = item.sequenceNum;
      }
      if (item.sequenceNum == this.currentPacketNum) {
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
      if (this.packetsIngested === this.lastPacketNum + 1 && this.lastPacketFound && this.currentPacketNum === this.lastPacketNum + 1) {
        this.closeStream();
      }
      return;
    }
    // Method to close the stream
    closeStream() {
      this.outOfOrderPackets = {};
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
    reset() {
      console.log("Resetting requests");
      this.requests = {};
      this.responses = {};
      this.currentIdentifier = 1;
    }
    async makeRequest(request, client) {
      await createPackets(request, this.currentIdentifier, (frame) => {
        client.postMessage({ payload: frame, type: "data" });
      });
      const prom = new Deferred();
      this.requests[this.currentIdentifier] = prom;
      this.currentIdentifier += 1;
      return prom.promise;
    }
    handleRequest(reqObj) {
      const packet = parsePacket(reqObj);
      if (packet.messageType === "BODY") {
        if (!this.responses[packet.identifier]) {
          console.error("No response found for", packet.identifier);
          return;
        }
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

  // serviceWorker/wsProxy.ts
  var WsHandler = class {
    ws;
    serverId;
    client;
    open = false;
    wsClosed = true;
    needsRestart = false;
    constructor(serverId, client) {
      const signalingServer = "wss://peepsignal.fly.dev";
      this.serverId = serverId;
      this.ws = new WebSocket(`${signalingServer}/?role=client&id=${serverId}`);
      this.setNewClient(client);
      this.ws.addEventListener("open", () => {
        this.open = true;
      });
      this.ws.addEventListener("close", () => {
        this.needsRestart = true;
      });
    }
    // Returns when websocket is open
    async ready() {
      if (this.open) {
        return;
      }
      return new Promise((resolve, reject) => {
        this.ws.addEventListener("open", () => {
          resolve();
        });
      });
    }
    setNewClient(client) {
      this.client = client;
      this.ws.addEventListener("message", (event) => {
        client.postMessage({ type: "signalingMessage", payload: event.data });
      });
    }
  };

  // serviceWorker/sw.ts
  var proxy = new HTTPProxy();
  var ws;
  self.addEventListener("install", (event) => {
    console.log("Service Worker installing.", self);
    console.log(event);
    self.skipWaiting();
  });
  self.addEventListener("activate", function(e) {
    console.log("Activating");
    self.clients.claim();
  });
  var lastClient = "";
  var iframeMode = true;
  var pageClient;
  async function handleIframeRequest(event, client) {
    if (!client) {
      return fetch(event.request);
    }
    const clientHostname = new URL(client.url).hostname;
    if (new URL(event.request.url).hostname !== clientHostname) {
      return fetch(event.request);
    }
    const isRootPage = event.request.headers.get("x-root-page") ? true : false;
    if (isRootPage) {
      pageClient = client;
      return proxy.makeRequest(event.request, client);
    }
    if (client.frameType === "top-level") {
      return fetch(event.request);
    }
    const url = new URL(event.request.url);
    if (url.pathname === "/iframe.html" || url.pathname === "/iframeScript.js") {
      return fetch(event.request);
    }
    return proxy.makeRequest(event.request, pageClient);
  }
  self.addEventListener("fetch", async (untypedEvent) => {
    const event = untypedEvent;
    event.respondWith(
      (async () => {
        const client = await self.clients.get(event.clientId);
        if (iframeMode) {
          return handleIframeRequest(event, client);
        }
        if (event.clientId !== lastClient || !peerConnected) {
          console.log(event.clientId, lastClient, peerConnected);
          peerConnected = false;
          lastClient = event.clientId;
          console.log("Detected restart");
          return fetch(event.request);
        }
        if (!client || !peerConnected) {
          return fetch(event.request);
        }
        const clientHostname = new URL(client.url).hostname;
        if (new URL(event.request.url).hostname !== clientHostname) {
          return fetch(event.request);
        }
        const body = await proxy.makeRequest(event.request, client);
        return body;
      })()
    );
  });
  var peerConnected = false;
  self.addEventListener("message", async (event) => {
    const clientObj = event.source;
    const client = await self.clients.get(clientObj.id);
    switch (event.data.type) {
      case "disconnected":
        console.log("Disconnected, resetting");
        peerConnected = false;
        proxy.reset();
        break;
      case "ready":
        peerConnected = true;
        client.postMessage({
          type: "ready"
        });
        break;
      case "data":
        proxy.handleRequest(event.data.payload);
        break;
      case "createWs":
        if (!ws || ws.serverId !== event.data.payload.serverId || ws.needsRestart) {
          console.log("New WS");
          ws = new WsHandler(event.data.payload.serverId, client);
        }
        ws.setNewClient(client);
        await ws.ready();
        client.postMessage({
          type: "createWs",
          payload: {
            reqId: event.data.payload.reqId
          }
        });
        break;
      case "signalingMessage":
        if (!ws) {
          console.error("No ws connection");
        }
        ws.ws.send(event.data.payload);
        break;
    }
  });
})();
//# sourceMappingURL=sw.js.map
