#!/usr/bin/env bash
set -euo pipefail
cd /opt/axecloud
set -a
source .env
set +a

INSTANCE_NAME="${WA_INSTANCE_NAME:-axecloud_console_admin}"
META_TOKEN="${WA_META_TOKEN:?WA_META_TOKEN required}"
PHONE_ID="${WA_PHONE_NUMBER_ID:?WA_PHONE_NUMBER_ID required}"
BUSINESS_ID="${WA_BUSINESS_ACCOUNT_ID:?WA_BUSINESS_ACCOUNT_ID required}"
BASE="http://evolution:8080"

call() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -w "\nHTTP:%{http_code}\n" -X "$method" \
      -H "apikey: ${EVOLUTION_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "${BASE}${path}"
  else
    curl -sS -w "\nHTTP:%{http_code}\n" -X "$method" \
      -H "apikey: ${EVOLUTION_API_KEY}" \
      "${BASE}${path}"
  fi
  echo "---"
}

echo "== Instâncias atuais =="
call GET "/instance/fetchInstances"

if call GET "/instance/connectionState/${INSTANCE_NAME}" | grep -q '"state"'; then
  echo "== Removendo instância existente: ${INSTANCE_NAME} =="
  call DELETE "/instance/logout/${INSTANCE_NAME}" || true
  call DELETE "/instance/delete/${INSTANCE_NAME}" || true
fi

CREATE_BODY=$(cat <<EOF
{
  "instanceName": "${INSTANCE_NAME}",
  "token": "${META_TOKEN}",
  "number": "${PHONE_ID}",
  "businessId": "${BUSINESS_ID}",
  "qrcode": false,
  "integration": "WHATSAPP-BUSINESS"
}
EOF
)

echo "== Criando instância Cloud API: ${INSTANCE_NAME} =="
call POST "/instance/create" "$CREATE_BODY"

echo "== Estado da conexão =="
call GET "/instance/connectionState/${INSTANCE_NAME}"

echo "== Instâncias após criação =="
call GET "/instance/fetchInstances"
