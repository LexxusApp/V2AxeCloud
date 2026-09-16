#!/bin/sh
# Atualiza uma vez por hora os bloqueios causados por assinatura ou teste vencido.
set -eu
cd /opt/axecloud
LOG=/var/log/axecloud-subscription-access-cron.log
CRON_SECRET=$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '\r\n')
{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS \
    --connect-timeout 20 --max-time 180 \
    -w "\nHTTP=%{http_code}\n" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "http://app:3000/api/v1/cron/subscription-access" || echo "CURL_FAIL=$?"
} >> "$LOG" 2>&1