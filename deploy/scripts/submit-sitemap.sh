#!/usr/bin/env bash
# Notifica Google/Bing sobre o sitemap após deploy na VPS.
# Cron sugerido (segunda 03:00): 0 3 * * 1 /opt/axecloud/deploy/scripts/submit-sitemap.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export SITE_URL="${SITE_URL:-https://axecloud.com.br}"
docker compose -f deploy/docker-compose.yml --env-file .env exec -T app node scripts/submit-sitemap.mjs
