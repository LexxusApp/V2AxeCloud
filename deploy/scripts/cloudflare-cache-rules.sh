#!/usr/bin/env bash
# Regras de cache Cloudflare (plano Free: Cache Rules limitadas).
# Token: Zone → Cache Rules → Edit + Zone Read
#
# Uso: bash deploy/scripts/cloudflare-cache-rules.sh
set -euo pipefail

API_BASE='https://api.cloudflare.com/client/v4'
ENV_FILE="${ENV_FILE:-/opt/axecloud/.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^CLOUDFLARE_' "$ENV_FILE" | sed 's/\r$//')
  set +a
fi

TOKEN="${CLOUDFLARE_API_TOKEN:-}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-axecloud.com.br}"

if [ -z "$TOKEN" ]; then
  echo "ERRO: defina CLOUDFLARE_API_TOKEN." >&2
  exit 1
fi

if [ -z "$ZONE_ID" ]; then
  ZONE_ID=$(curl -sS "${API_BASE}/zones?name=${ZONE_NAME}" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('success') and d.get('result') else '')")
fi

if [ -z "$ZONE_ID" ]; then
  echo "ERRO: ZONE_ID não encontrado para ${ZONE_NAME}." >&2
  exit 1
fi

PHASE='http_request_cache_settings'
RULESET_DESC='AxeCloud cache rules'

PAYLOAD=$(cat <<EOF
{
  "description": "${RULESET_DESC}",
  "rules": [
    {
      "description": "Bypass cache — API, painel e ícones PWA",
      "expression": "(http.request.uri.path starts_with \"/api/\") or (http.request.uri.path starts_with \"/login\") or (http.request.uri.path starts_with \"/dashboard\") or (http.request.uri.path starts_with \"/webhook/\") or (http.request.uri.path starts_with \"/pwa-\") or (http.request.uri.path starts_with \"/axecloud_\") or (http.request.uri.path eq \"/favicon.ico\") or (http.request.uri.path eq \"/manifest.webmanifest\") or (http.request.uri.path eq \"/sw.js\")",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": false
      }
    },
    {
      "description": "Cache longo — bundles Vite (/m-assets/)",
      "expression": "(http.request.uri.path starts_with \"/m-assets/\")",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": {
          "mode": "override_origin",
          "default": 31536000
        }
      }
    },
    {
      "description": "Cache médio — screenshots e estáticos",
      "expression": "(http.request.uri.path starts_with \"/screenshots/\") or (http.request.uri.path eq \"/favicon.ico\") or (http.request.uri.path eq \"/robots.txt\") or (http.request.uri.path eq \"/sitemap.xml\") or (http.request.uri.path eq \"/og-image.png\")",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": {
          "mode": "override_origin",
          "default": 2592000
        }
      }
    },
    {
      "description": "HTML marketing — respeitar origem (no-store)",
      "expression": "(http.host eq \"axecloud.com.br\") and (http.request.uri.path eq \"/\")",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": {
          "mode": "bypass_by_default"
        }
      }
    }
  ]
}
EOF
)

ENTRY=$(curl -sS "${API_BASE}/zones/${ZONE_ID}/rulesets/phases/${PHASE}/entrypoint" \
  -H "Authorization: Bearer ${TOKEN}")

RULESET_ID=$(echo "$ENTRY" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result') or {}; print(r.get('id',''))")

if [ -n "$RULESET_ID" ]; then
  echo "[info] Atualizando ruleset ${RULESET_ID}..."
  RESP=$(curl -sS -X PUT "${API_BASE}/zones/${ZONE_ID}/rulesets/${RULESET_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$PAYLOAD")
else
  echo "[info] Criando ruleset de cache..."
  RESP=$(curl -sS -X POST "${API_BASE}/zones/${ZONE_ID}/rulesets" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$(python3 -c "import json,sys; p=json.loads(sys.stdin.read()); p['kind']='zone'; p['phase']='${PHASE}'; print(json.dumps(p))" <<< "$PAYLOAD")")
fi

echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success=', d.get('success')); errs=d.get('errors',[]); print('errors=', errs if errs else 'none')"
