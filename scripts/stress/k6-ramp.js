/**
 * Ramp — sobe VUs até 200 para achar teto. Pare se CrowdSec/Caddy bloquear seu IP.
 * Env: BASE_URL
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://axecloud.com.br";

export const options = {
  stages: [
    { duration: "2m", target: 20 },
    { duration: "2m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 150 },
    { duration: "2m", target: 200 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.10"],
  },
};

export default function () {
  const res = http.batch([
    ["GET", `${BASE}/api/ping`, null, { tags: { route: "ping" } }],
    ["GET", `${BASE}/api/health-check`, null, { tags: { route: "health" } }],
  ]);

  check(res[0], { "ping": (r) => r.status === 200 || r.status === 429 });
  check(res[1], { "health": (r) => r.status === 200 || r.status === 429 });

  sleep(0.3);
}
