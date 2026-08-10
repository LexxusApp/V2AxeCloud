#!/usr/bin/env bash
set -euo pipefail

cd /opt/axecloud

secret="$(sed -n 's/^CRON_SECRET=//p' .env | tail -n 1)"
if [ -z "$secret" ]; then
  echo "CRON_SECRET ausente" >&2
  exit 1
fi

docker compose -f deploy/docker-compose.yml --env-file .env exec -T app \
  node -e 'fetch("http://127.0.0.1:3000/api/cron?job=growth-prospecting", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } }).then(async (r) => { if (!r.ok) throw new Error("HTTP " + r.status + " " + await r.text()); }).catch((e) => { console.error(e.message); process.exit(1); })'
