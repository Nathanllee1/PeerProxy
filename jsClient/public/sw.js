"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/cookie/index.js
  var require_cookie = __commonJS({
    "node_modules/cookie/index.js"(exports) {
      "use strict";
      exports.parse = parse;
      exports.serialize = serialize;
      var __toString = Object.prototype.toString;
      var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
      function parse(str, options) {
        if (typeof str !== "string") {
          throw new TypeError("argument str must be a string");
        }
        var obj = {};
        var opt = options || {};
        var dec = opt.decode || decode;
        var index = 0;
        while (index < str.length) {
          var eqIdx = str.indexOf("=", index);
          if (eqIdx === -1) {
            break;
          }
          var endIdx = str.indexOf(";", index);
          if (endIdx === -1) {
            endIdx = str.length;
          } else if (endIdx < eqIdx) {
            index = str.lastIndexOf(";", eqIdx - 1) + 1;
            continue;
          }
          var key = str.slice(index, eqIdx).trim();
          if (void 0 === obj[key]) {
            var val = str.slice(eqIdx + 1, endIdx).trim();
            if (val.charCodeAt(0) === 34) {
              val = val.slice(1, -1);
            }
            obj[key] = tryDecode(val, dec);
          }
          index = endIdx + 1;
        }
        return obj;
      }
      function serialize(name, val, options) {
        var opt = options || {};
        var enc = opt.encode || encode;
        if (typeof enc !== "function") {
          throw new TypeError("option encode is invalid");
        }
        if (!fieldContentRegExp.test(name)) {
          throw new TypeError("argument name is invalid");
        }
        var value = enc(val);
        if (value && !fieldContentRegExp.test(value)) {
          throw new TypeError("argument val is invalid");
        }
        var str = name + "=" + value;
        if (null != opt.maxAge) {
          var maxAge = opt.maxAge - 0;
          if (isNaN(maxAge) || !isFinite(maxAge)) {
            throw new TypeError("option maxAge is invalid");
          }
          str += "; Max-Age=" + Math.floor(maxAge);
        }
        if (opt.domain) {
          if (!fieldContentRegExp.test(opt.domain)) {
            throw new TypeError("option domain is invalid");
          }
          str += "; Domain=" + opt.domain;
        }
        if (opt.path) {
          if (!fieldContentRegExp.test(opt.path)) {
            throw new TypeError("option path is invalid");
          }
          str += "; Path=" + opt.path;
        }
        if (opt.expires) {
          var expires = opt.expires;
          if (!isDate(expires) || isNaN(expires.valueOf())) {
            throw new TypeError("option expires is invalid");
          }
          str += "; Expires=" + expires.toUTCString();
        }
        if (opt.httpOnly) {
          str += "; HttpOnly";
        }
        if (opt.secure) {
          str += "; Secure";
        }
        if (opt.partitioned) {
          str += "; Partitioned";
        }
        if (opt.priority) {
          var priority = typeof opt.priority === "string" ? opt.priority.toLowerCase() : opt.priority;
          switch (priority) {
            case "low":
              str += "; Priority=Low";
              break;
            case "medium":
              str += "; Priority=Medium";
              break;
            case "high":
              str += "; Priority=High";
              break;
            default:
              throw new TypeError("option priority is invalid");
          }
        }
        if (opt.sameSite) {
          var sameSite = typeof opt.sameSite === "string" ? opt.sameSite.toLowerCase() : opt.sameSite;
          switch (sameSite) {
            case true:
              str += "; SameSite=Strict";
              break;
            case "lax":
              str += "; SameSite=Lax";
              break;
            case "strict":
              str += "; SameSite=Strict";
              break;
            case "none":
              str += "; SameSite=None";
              break;
            default:
              throw new TypeError("option sameSite is invalid");
          }
        }
        return str;
      }
      function decode(str) {
        return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
      }
      function encode(val) {
        return encodeURIComponent(val);
      }
      function isDate(val) {
        return __toString.call(val) === "[object Date]" || val instanceof Date;
      }
      function tryDecode(str, decode2) {
        try {
          return decode2(str);
        } catch (e) {
          return str;
        }
      }
    }
  });

  // serviceWorker/cookieManager.ts
  var import_cookie = __toESM(require_cookie(), 1);
  var Cookies = class {
    cookies = {};
    reservedHeaders = ["domain", "encode", "expires", "httponly", "maxage", "partitioned", "path"];
    setCookie(cookieString) {
      const parsedCookie = import_cookie.default.parse(cookieString);
      for (const key in parsedCookie) {
        if (this.reservedHeaders.includes(key.toLowerCase())) {
          continue;
        }
        this.cookies[key] = parsedCookie;
      }
    }
    getCookies(domain) {
      return Object.keys(this.cookies).map((name) => import_cookie.default.serialize(name, this.cookies[name][name])).reduce((acc, storedCookie) => `${acc} ${storedCookie};`, "");
    }
    resetCookies() {
      this.cookies = {};
    }
  };
  var cookieManager = new Cookies();

  // serviceWorker/createPacket.ts
  var IDENTIFIER_LENGTH = 32;
  var TYPE_LEGNTH = 1;
  var CONTENT_LENGTH = 16;
  var FLAGS = 8;
  var HEADER_LENGTH = IDENTIFIER_LENGTH + TYPE_LEGNTH + CONTENT_LENGTH + FLAGS;
  function createFrame(identifier, messageType, payload, finalMessage, sequenceNum, heartbeat = false, cancel = false) {
    const headerSize = 11;
    let buffer = new ArrayBuffer(headerSize + payload.byteLength);
    let view = new DataView(buffer);
    view.setUint32(0, identifier);
    view.setUint32(4, sequenceNum);
    view.setUint16(8, payload.byteLength & 65535);
    let flags = (messageType === "HEADER" ? 0 : 1) | (finalMessage ? 1 : 0) << 1 | (heartbeat ? 1 : 0) << 2 | (cancel ? 1 : 0) << 3;
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
    if (request.credentials === "include" || request.credentials === "same-origin") {
      const cookies = cookieManager.getCookies(new URL(request.url).hostname);
      formattedHeaders["Cookie"] = cookies;
    }
    formattedHeaders["method"] = request.method;
    formattedHeaders["url"] = new URL(request.url).pathname + new URL(request.url).search + new URL(request.url).hash;
    console.log(formattedHeaders);
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
    const flagCodes = {
      0: [false, false],
      1: [false, true],
      2: [true, false],
      3: [true, true]
    };
    let flags = view.getUint8(10);
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
    client;
    reset() {
      console.log("Resetting requests");
      this.requests = {};
      this.responses = {};
    }
    async makeRequest(request, client) {
      this.client = client;
      await createPackets(request, this.currentIdentifier, (frame) => {
        client.postMessage({ payload: frame, type: "data" });
      });
      const prom = new Deferred();
      this.requests[this.currentIdentifier] = prom;
      this.currentIdentifier += 1;
      return prom.promise;
    }
    cancelAllRequests() {
      for (const id in this.requests) {
        this.requests[id].reject("Request cancelled");
        const cancelFrame = createFrame(parseInt(id), "BODY", new Uint8Array(), true, 0, false, true);
        this.client.postMessage({
          type: "data",
          payload: cancelFrame
        });
      }
      this.reset();
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
        if (headerKey === "Set-Cookie") {
          console.log("Setting cookies", parsedHeaders[headerKey]);
          for (const cookie2 of parsedHeaders[headerKey]) {
            console.log("Setting cookie", cookie2);
            cookieManager.setCookie(cookie2);
            this.client.postMessage({
              type: "set-cookie",
              payload: cookie2
            });
          }
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
    console.log("Service Worker installing.", self);
    console.log(event);
    self.skipWaiting();
  });
  self.addEventListener("activate", function(e) {
    console.log("Activating");
    self.clients.claim();
  });
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
        return handleIframeRequest(event, client);
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
      case "cancelRequests":
        console.log("Cancelling requests");
        proxy.cancelAllRequests();
        break;
      case "data":
        proxy.handleRequest(event.data.payload);
        break;
    }
  });
})();
/*! Bundled license information:

cookie/index.js:
  (*!
   * cookie
   * Copyright(c) 2012-2014 Roman Shtylman
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)
*/
//# sourceMappingURL=sw.js.map
