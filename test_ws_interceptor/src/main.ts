// @ts-ignore
import { wsHook } from './wsHook.js';


console.log(wsHook)

wsHook.before = function (data: any, url: string, wsObject: WebSocket) {
  console.log("Sending message to " + url + " : " + data);
}

// Make sure your program calls `wsClient.onmessage` event handler somewhere.
wsHook.after = function (messageEvent: MessageEvent, url: string, wsObject: WebSocket) {
  console.log("Received message from " + url + " : " + messageEvent.data);
  return messageEvent;
}

// if you do not want to propagate the MessageEvent further down, just return null
wsHook.after = function (messageEvent, url, wsObject) {
  console.log("Received message from " + url + " : " + messageEvent.data);
  // This example can ping-pong forever, so maybe use some conditions
  wsObject.send("Intercepted and sent again")
  return null;
}

