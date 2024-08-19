

export function registerProtocolHandler() {

  // check if base url is *.peerproxy.dev
  const baseUrl = window.location.hostname
  if (!baseUrl.endsWith("peerproxy.dev")) {
    return
  }

  navigator.registerProtocolHandler('web+wrtc', 'http://peerproxy.dev/?peerproxyid=%s')
}