#!/usr/bin/env bash
# Notifica os buscadores sobre o sitemap após uma publicação Cloudflare.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export SITE_URL="${SITE_URL:-https://axecloud.com.br}"
node scripts/submit-sitemap.mjs
