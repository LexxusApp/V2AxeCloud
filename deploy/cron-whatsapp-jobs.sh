#!/bin/sh
set -eu
cd /opt/axecloud
CRON_SECRET=$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '\r\n')
docker run --rm --network deploy_web curlimages/curl:8.5.0 -fsS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://app:3000/api/v1/cron/whatsapp-jobs" >/dev/null 2>&1
