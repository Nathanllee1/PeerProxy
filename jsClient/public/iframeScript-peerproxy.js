
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.error("Browser not supported")
        return
    }

    let registration = await navigator.serviceWorker.getRegistration()

    // console.log(registration ? 'Service Worker registered in iframe' : 'Service Worker not registered in iframe')

    if (registration) {
        return registration
    }

    registration = await navigator.serviceWorker.register('/sw.js')
        .catch(error => {
            console.error('Service Worker registration failed in iframe:', error);
            throw error
        })

    return registration
}

registerServiceWorker();

// hiiiiiiiiiiiii nathan :)