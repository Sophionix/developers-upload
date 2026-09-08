import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 3,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";
// Set ADMIN_COOKIE env var to a valid admin session cookie for real tests
const ADMIN_COOKIE = __ENV.ADMIN_COOKIE || "";

export default function () {
  const res = http.get(`${BASE}/api/admin/users?limit=20`, {
    headers: { Cookie: ADMIN_COOKIE },
  });
  // 401 is fine without a real session — we're testing routing overhead
  check(res, { "responded": (r) => r.status < 500 });
  sleep(1);
}
