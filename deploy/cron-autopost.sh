#!/bin/sh
set -eu
cd /opt/axecloud
docker compose -f deploy/docker-compose.yml --env-file .env exec -T app \
  node scripts/facebookAutopost.js >> /var/log/axecloud-autopost.log 2>&1
