

self.addEventListener('install', (event) => {
    console.log('Service Worker installing.', self);

    self.skipWaiting()
});

self.addEventListener('activate', function (e) {
    //  self.registration.unregister()
    console.log("Activating")

    self.clients.claim()
});

self.addEventListener("fetch", async (untypedEvent) => {

    const event = untypedEvent
    console.log(new URL(event.request.url).hostname)

});