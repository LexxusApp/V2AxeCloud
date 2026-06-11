#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="${ENV_FILE:-/opt/axecloud/.env}"
# shellcheck disable=SC1090
source <(grep -E '^CLOUDFLARE_' "$ENV_FILE" | sed 's/\r$//')
TOKEN="${CLOUDFLARE_API_TOKEN}"
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-axecloud.com.br}"
ZONE_ID=$(curl -sS "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'])")

probe() {
  local label="$1"
  local path="$2"
  echo "=== ${label} ==="
  curl -sS "https://api.cloudflare.com/client/v4${path}" -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success=', d.get('success')); errs=d.get('errors',[]); print('errors=', errs[:2] if errs else 'none'); res=d.get('result'); print('result_type=', type(res).__name__, 'len=', len(res) if isinstance(res,list) else ('obj' if res else 'null'))"
}

probe "list rulesets" "/zones/${ZONE_ID}/rulesets"
probe "entrypoint custom" "/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint"
probe "firewall rules legacy" "/zones/${ZONE_ID}/firewall/rules"
probe "rulesets phase managed" "/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_managed/entrypoint"
