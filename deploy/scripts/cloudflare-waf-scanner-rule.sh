#!/usr/bin/env bash
# Cria/atualiza regra WAF "Block scanner paths" (Custom Rules / Rulesets API).
#
# Token necessário: Zone → WAF → Edit (+ Zone Read na zona axecloud.com.br)
# "Firewall Services → Edit" sozinho NÃO basta desde 2025-06.
#
# Uso: bash deploy/scripts/cloudflare-waf-scanner-rule.sh
set -euo pipefail

RULE_DESCRIPTION='AxeCloud Block scanner paths'
RULE_EXPRESSION='(http.request.uri.path contains "/wp-admin") or (http.request.uri.path contains "/.env") or (http.request.uri.path contains "/.git") or (http.request.uri.path contains "/phpmyadmin") or (http.request.uri.path contains "/pma/") or (http.request.uri.path contains "/xmlrpc.php") or (http.request.uri.path contains "/vendor/phpunit") or (http.request.uri.path contains "/actuator") or (http.request.uri.path contains "/containers/json")'

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

cf_api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  if [ -n "$data" ]; then
    curl -sS -X "$method" "${API_BASE}${path}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$data"
  else
    curl -sS -X "$method" "${API_BASE}${path}" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

cf_fail_hint() {
  echo "ERRO: token sem permissão Zone → WAF → Edit." >&2
  echo "Edite o token no painel e adicione: Zone / WAF / Edit (zona axecloud.com.br)." >&2
  echo "Ou crie manualmente: Security → Security rules → Custom rule → Block." >&2
}

if [ -z "$ZONE_ID" ]; then
  echo "[cf] resolvendo zone_id para ${ZONE_NAME}"
  ZONE_RESP=$(cf_api GET "/zones?name=${ZONE_NAME}")
  ZONE_ID=$(echo "$ZONE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('success') and d.get('result') else '')" 2>/dev/null || true)
  if [ -z "$ZONE_ID" ]; then
    echo "ERRO: zone não encontrada para ${ZONE_NAME}" >&2
    exit 1
  fi
  echo "[cf] zone_id=${ZONE_ID}"
fi

echo "[cf] lendo entrypoint http_request_firewall_custom"
ENTRY=$(cf_api GET "/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint")
ENTRY_META=$(echo "$ENTRY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
errs=d.get('errors',[])
codes={e.get('code') for e in errs}
auth=10000 in codes
missing=10003 in codes or (not d.get('success') and not errs)
print(d.get('success'), d.get('result',{}).get('id','') if d.get('success') else '', 'auth' if auth else ('missing' if missing or not d.get('success') else 'ok'))
")
ENTRY_OK=$(echo "$ENTRY_META" | awk '{print $1}')
RULESET_ID=$(echo "$ENTRY_META" | awk '{print $2}')
ENTRY_STATE=$(echo "$ENTRY_META" | awk '{print $3}')

if [ "$ENTRY_STATE" = "auth" ]; then
  cf_fail_hint
  echo "$ENTRY" | python3 -m json.tool 2>/dev/null || echo "$ENTRY"
  exit 1
fi

if [ "$ENTRY_OK" != "True" ] || [ -z "$RULESET_ID" ]; then
  echo "[cf] criando entrypoint com regra de scanner"
  CREATE=$(cf_api POST "/zones/${ZONE_ID}/rulesets" "$(python3 -c "
import json
print(json.dumps({
  'name': 'zone',
  'description': 'AxeCloud custom WAF',
  'kind': 'zone',
  'phase': 'http_request_firewall_custom',
  'rules': [{
    'description': '''${RULE_DESCRIPTION}''',
    'expression': '''${RULE_EXPRESSION}''',
    'action': 'block',
    'enabled': True,
  }],
}))
")")
  echo "$CREATE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print('[cf] WAF custom rule criada OK')
else:
    print(d, file=sys.stderr)
    sys.exit(1)
"
  exit 0
fi

echo "[cf] ruleset_id=${RULESET_ID}"
EXISTING=$(echo "$ENTRY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d.get('result',{}).get('rules',[]):
    if r.get('description')=='${RULE_DESCRIPTION}':
        print(r.get('id',''))
        break
")

if [ -n "$EXISTING" ]; then
  echo "[cf] regra já existe (id=${EXISTING}) — atualizando"
  UPDATE=$(cf_api PATCH "/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules/${EXISTING}" "$(python3 -c "
import json
print(json.dumps({
  'description': '''${RULE_DESCRIPTION}''',
  'expression': '''${RULE_EXPRESSION}''',
  'action': 'block',
  'enabled': True,
}))
")")
else
  echo "[cf] adicionando regra de scanner"
  UPDATE=$(cf_api POST "/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules" "$(python3 -c "
import json
print(json.dumps({
  'description': '''${RULE_DESCRIPTION}''',
  'expression': '''${RULE_EXPRESSION}''',
  'action': 'block',
  'enabled': True,
}))
")")
fi

echo "$UPDATE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print('[cf] WAF scanner rule OK')
else:
    print(d, file=sys.stderr)
    sys.exit(1)
"
