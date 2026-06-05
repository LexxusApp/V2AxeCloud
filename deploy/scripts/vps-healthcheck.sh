#!/bin/bash
# Monitoramento local: pinga a API via rede Docker (sem depender de DNS externo).
set -euo pipefail
LOG=/var/log/axecloud-healthcheck.log
TS=$(date -Iseconds)
URL="http://app:3000/api/plans"
CODE=$(docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS -o /dev/null -w "%{http_code}" --connect-timeout 10 "$URL" 2>/dev/null || echo "000")
if [ "$CODE" = "200" ]; then
  echo "$TS OK plans=$CODE" >> "$LOG"
  exit 0
fi
echo "$TS FAIL plans=$CODE" >> "$LOG"
# Mantém log enxuto
tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
exit 1
