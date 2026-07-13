#!/bin/bash
# Monitora, a cada 5 minutos, as rotas públicas e o endpoint do funil comercial.
set -uo pipefail

LOG=/var/log/axecloud-external-healthcheck.log
TS=$(date -Iseconds)
BASE="${AXECLOUD_PUBLIC_BASE_URL:-https://axecloud.com.br}"
FAILED=0
RESULTS=()

check_route() {
  local path="$1"
  local expected="${2:-200}"
  local code
  code=$(curl -sSL -o /dev/null -w "%{http_code}" --connect-timeout 12 --max-time 20 "${BASE}${path}" 2>/dev/null || echo "000")
  RESULTS+=("${path}=${code}")
  if [ "$code" != "$expected" ]; then FAILED=1; fi
}

check_route "/"
check_route "/register"
check_route "/terreiros"
check_route "/espaco-do-fiel"
check_route "/eventos"
check_route "/api/plans"

# Um corpo vazio deve ser recusado com 400; isso confirma que a rota de métricas existe e responde.
METRIC_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 12 --max-time 20 \
  -H "Content-Type: application/json" -d '{}' "${BASE}/api/metrics/conversion-event" 2>/dev/null || echo "000")
RESULTS+=("conversion-event=${METRIC_CODE}")
if [ "$METRIC_CODE" != "400" ]; then FAILED=1; fi

SUMMARY="${RESULTS[*]}"
if [ "$FAILED" -eq 0 ]; then
  echo "$TS OK commercial $SUMMARY" >> "$LOG"
else
  echo "$TS FAIL commercial $SUMMARY" >> "$LOG"
  logger -t axecloud-commercial-monitor "FAIL $SUMMARY"
fi

tail -n 1000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
exit "$FAILED"
