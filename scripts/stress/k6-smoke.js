/**
 * Smoke test — 5 VUs, 1 min. Uso: k6 run scripts/stress/k6-smoke.js
 * Env: BASE_URL (default https://axecloud.com.br)
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://axecloud.com.br";

export const options = {
  vus: 5,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  const ping = http.get(`${BASE}/api/ping`);
  check(ping, { "ping 200": (r) => r.status === 200 });

  const health = http.get(`${BASE}/api/health-check`);
  check(health, { "health 200": (r) => r.status === 200 });

  sleep(1);
}
