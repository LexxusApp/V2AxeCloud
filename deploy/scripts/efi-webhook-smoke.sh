#!/bin/bash
# Smoke test do webhook EFI (secret + token inválido = fluxo seguro sem ativar tenant).
set -euo pipefail
cd /opt/axecloud
SECRET=$(grep -m1 '^EFI_WEBHOOK_SECRET=' .env | cut -d= -f2-)
BASE="https://axecloud.com.br/api/webhooks/efi"

echo "[1] sem secret (esperado 401)"
CODE1=$(curl -sS -o /tmp/efi-wh-1.txt -w "%{http_code}" -X POST "$BASE" \
  -H "Content-Type: application/json" -d '{"notification":"smoke-invalid-token"}')
echo "HTTP $CODE1 body=$(head -c 80 /tmp/efi-wh-1.txt)"

echo "[2] com secret + token inválido (esperado 200 ou 422, nunca 401)"
CODE2=$(curl -sS -o /tmp/efi-wh-2.txt -w "%{http_code}" -X POST "${BASE}?secret=${SECRET}" \
  -H "Content-Type: application/json" -d '{"notification":"smoke-invalid-token-axecloud"}')
echo "HTTP $CODE2 body=$(head -c 120 /tmp/efi-wh-2.txt)"

if [ "$CODE1" = "401" ] && [ "$CODE2" != "401" ]; then
  echo "OK webhook smoke"
  exit 0
fi
echo "FALHA webhook smoke code1=$CODE1 code2=$CODE2"
exit 1
