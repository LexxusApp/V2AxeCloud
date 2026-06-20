/**
 * Baseline — tráfego misto realista, 30 VUs, 5 min.
 * Env: BASE_URL, STRESS_AUTH_TOKEN (opcional)
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://axecloud.com.br";
const TOKEN = __ENV.STRESS_AUTH_TOKEN || "";

export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "3m", target: 30 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    "http_req_duration{route:ping}": ["p(95)<2000"],
    "http_req_duration{route:landing}": ["p(95)<4000"],
  },
};

function authHeaders() {
  if (!TOKEN) return {};
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

export default function () {
  const roll = Math.random();

  if (roll < 0.2) {
    const res = http.get(`${BASE}/api/ping`, { tags: { route: "ping" } });
    check(res, { "ping ok": (r) => r.status === 200 });
  } else if (roll < 0.4) {
    const res = http.get(`${BASE}/api/health-check`, { tags: { route: "health" } });
    check(res, { "health ok": (r) => r.status === 200 });
  } else if (roll < 0.5) {
    const res = http.get(`${BASE}/api/public-config`, { tags: { route: "public-config" } });
    check(res, { "public-config ok": (r) => r.status === 200 });
  } else if (roll < 0.75) {
    const res = http.get(`${BASE}/`, { tags: { route: "landing" } });
    check(res, { "landing ok": (r) => r.status === 200 });
  } else if (roll < 0.9) {
    const res = http.get(`${BASE}/login`, { tags: { route: "login-spa" } });
    check(res, { "login shell ok": (r) => r.status === 200 });
  } else {
    const res = http.get(`${BASE}/api/plans`, { tags: { route: "plans" } });
    check(res, { "plans ok": (r) => r.status === 200 || r.status === 429 });
  }

  if (TOKEN && Math.random() < 0.15) {
    const res = http.get(`${BASE}/api/tenant-info`, {
      headers: authHeaders(),
      tags: { route: "tenant-info" },
    });
    check(res, { "tenant-info ok": (r) => r.status === 200 || r.status === 401 });
  }

  sleep(Math.random() * 2 + 0.5);
}
