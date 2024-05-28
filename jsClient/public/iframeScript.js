
async function getRegistration() {
    if (!('serviceWorker' in navigator)) {
        console.error("Browser not supported")
        return
    }

    console.log("HELLO")

    let registration = await navigator.serviceWorker.getRegistration()

    console.log(registration ? 'Service Worker registered in iframe' : 'Service Worker not registered in iframe')

    if (registration) {
        return registration
    }

    registration = await navigator.serviceWorker.register('/sw.js')
        .catch(error => {
            console.error('Service Worker registration failed in iframe:', error);
        })

    console.log(registration)
    return registration
}

async function main() {
    const registration = await getRegistration()
    console.log(registration)
    registration?.addEventListener('message', event => {
        console.log('Message received in iframe:', event.data)
    })
}

main()

// hiiiiiiiiiiiii nathan :)