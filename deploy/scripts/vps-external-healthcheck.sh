#!/bin/bash
# Pinga a API pela URL pública (Cloudflare + Caddy). Complementa vps-healthcheck.sh (rede Docker).
set -euo pipefail
LOG=/var/log/axecloud-external-healthcheck.log
TS=$(date -Iseconds)
URL="${AXECLOUD_PUBLIC_URL:-https://axecloud.com.br/api/plans}"
CODE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 15 --max-time 20 "$URL" 2>/dev/null || echo "000")
if [ "$CODE" = "200" ]; then
  echo "$TS OK external plans=$CODE" >> "$LOG"
  exit 0
fi
echo "$TS FAIL external plans=$CODE url=$URL" >> "$LOG"
tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
exit 1
