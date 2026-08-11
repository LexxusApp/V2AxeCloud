#!/usr/bin/env bash
set -euo pipefail

cd /opt/axecloud

log_file="/var/log/axecloud-growth.log"
touch "$log_file"
chmod 640 "$log_file"
exec >>"$log_file" 2>&1
echo "[$(date -Is)] growth-prospecting tick"

secret="$(sed -n 's/^CRON_SECRET=//p' .env | tail -n 1)"
if [ -z "$secret" ]; then
  echo "CRON_SECRET ausente" >&2
  exit 1
fi

docker compose -f deploy/docker-compose.yml --env-file .env exec -T app \
  node -e 'fetch("http://127.0.0.1:3000/api/cron?job=growth-prospecting", { headers: { Authorization: "Bearer " + process.env.CRON_SECRET } }).then(async (r) => { const body = await r.text(); console.log(body); if (!r.ok) throw new Error("HTTP " + r.status); }).catch((e) => { console.error(e.message); process.exit(1); })'
