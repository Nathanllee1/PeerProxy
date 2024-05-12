if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/iframe-sw.js')
        .then(registration => {
            console.log('Service Worker registered in iframe:', registration);
        })
        .catch(error => {
            console.error('Service Worker registration failed in iframe:', error);
        });
}
