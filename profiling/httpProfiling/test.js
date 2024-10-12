import http from 'k6/http';
import { check, sleep } from 'k6';

// Options for the test
export const options = {
  vus: 500, // Number of virtual users (VUs)
  duration: '30s', // Duration of the test
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

// Test function that k6 will run
export default function () {
  const res = http.get('http://localhost:3005'); // Replace with your server URL

  // Checking the response status code
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Simulate user wait time between requests
  sleep(1);
}
