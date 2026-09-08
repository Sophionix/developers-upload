import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "60s", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // Card library (cached list)
  const decksRes = http.get(`${BASE}/api/content/decks`);
  check(decksRes, { "decks 200": (r) => r.status === 200 });

  sleep(0.5);

  // Guest card preview (no auth)
  const previewRes = http.get(`${BASE}/api/guest/cards`);
  check(previewRes, { "guest cards 200": (r) => r.status === 200 });

  sleep(1);
}
