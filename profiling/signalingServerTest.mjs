import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Trend, Counter, Rate } from 'k6/metrics';

export let options = {
    stages: [
        { duration: '30s', target: 10 }, // ramp up to 10 users
        { duration: '1m', target: 10 },  // stay at 10 users for 1 minute
        { duration: '30s', target: 50 }, // ramp up to 50 users
        { duration: '1m', target: 50 },  // stay at 50 users for 1 minute
        { duration: '30s', target: 100 }, // ramp up to 100 users
        { duration: '1m', target: 100 },  // stay at 100 users for 1 minute
        { duration: '30s', target: 200 }, // ramp up to 200 users
        { duration: '1m', target: 200 },  // stay at 200 users for 1 minute
        { duration: '30s', target: 0 },  // ramp down to 0 users
    ],
};

// Custom metrics
let connectionTime = new Trend('connection_time');
let messageLatency = new Trend('message_latency');
let connectionSuccess = new Counter('connection_success');
let connectionFailures = new Counter('connection_failures');
let messageSuccessRate = new Rate('message_success_rate');

export default function () {
    const url = 'wss://peepsignal.fly.dev/?role=client';

    // Establish WebSocket connection
    const res = ws.connect(url, {}, function (socket) {
        let connectStartTime = new Date().getTime();

        socket.on('open', function () {
            let connectEndTime = new Date().getTime();
            let duration = connectEndTime - connectStartTime;

            connectionTime.add(duration);
            connectionSuccess.add(1);

            console.log('connected');

            // Send a test message
            let messageStartTime = new Date().getTime();
            socket.send(JSON.stringify({ mtype: "idReq" }));

            socket.on('message', function (message) {
                let messageEndTime = new Date().getTime();
                let latency = messageEndTime - messageStartTime;

                messageLatency.add(latency);
                messageSuccessRate.add(true);

                console.log(`Received message: ${message}`);
            });

            socket.setTimeout(function () {
                console.log('Closing socket');
                socket.close();
            }, 10000); // Close connection after 10 seconds
        });

        socket.on('close', function () {
            console.log('disconnected');
        });

        socket.on('error', function (e) {
            console.error('An unexpected error occurred: ', e.error());
            connectionFailures.add(1);
            messageSuccessRate.add(false);
        });

        sleep(1);
    });

    check(res, {
        'Connected successfully': (r) => r && r.status === 101,
    });
}
