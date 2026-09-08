import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // Synthetic payload — will fail sig verification (expected 400)
  // We're testing handler overhead, not business logic
  const res = http.post(
    `${BASE}/api/webhooks/stripe`,
    JSON.stringify({ id: "evt_test", type: "ping" }),
    { headers: { "Content-Type": "application/json", "stripe-signature": "t=0,v1=bad" } }
  );
  // 400 is expected for bad sig; we're verifying <500ms overhead
  check(res, { "handled quickly": (r) => r.timings.duration < 500 });
}
