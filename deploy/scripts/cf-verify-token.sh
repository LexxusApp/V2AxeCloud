#!/usr/bin/env bash
set -euo pipefail
ENV_FILE="${ENV_FILE:-/opt/axecloud/.env}"
# shellcheck disable=SC1090
source <(grep -E '^CLOUDFLARE_' "$ENV_FILE" | sed 's/\r$//')
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-axecloud.com.br}"
echo "token_len=${#TOKEN}"
echo "=== verify ==="
curl -sS "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool | head -20
echo "=== zone ==="
curl -sS "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success', d.get('success'), 'zone', d.get('result',[{}])[0].get('name') if d.get('result') else None)"
ZONE_ID=$(curl -sS "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" -H "Authorization: Bearer ${TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('success') and d.get('result') else '')")
echo "zone_id=${ZONE_ID}"
echo "=== entrypoint ==="
curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint" \
  -H "Authorization: Bearer ${TOKEN}" | python3 -m json.tool | head -30
