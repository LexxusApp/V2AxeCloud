#!/bin/bash
# Cria instância Baileys com QR Code (escaneie no WhatsApp → Aparelhos conectados).
set -euo pipefail
cd /opt/axecloud

INST="${EVOLUTION_AUTOPOST_INSTANCE:-axecloud_autopost}"
NUM="${AUTOPOST_WHATSAPP_TO:-5511920033501}"
KEY="$(grep -m1 '^EVOLUTION_API_KEY=' .env | cut -d= -f2- | tr -d '\r')"

curl_ev() {
  docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS "$@"
}

mkdir -p assets/ready_posts
QR_OUT="/opt/axecloud/assets/ready_posts/autopost-qr.png"

echo "Instância: $INST | destino autopost: $NUM"

curl_ev -X DELETE -H "apikey: $KEY" "http://evolution:8080/instance/logout/$INST" >/dev/null 2>&1 || true
curl_ev -X DELETE -H "apikey: $KEY" "http://evolution:8080/instance/delete/$INST" >/dev/null 2>&1 || true
sleep 2

echo "=== CREATE (Baileys + QR) ==="
CREATE=$(curl_ev -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"$INST\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}" \
  "http://evolution:8080/instance/create")
echo "$CREATE" | head -c 400
echo ""

save_qr() {
  echo "$1" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.qrcode.base64 // .base64 // empty' 2>/dev/null \
    | sed 's/^data:image\/png;base64,//' \
    | base64 -d > "$QR_OUT" 2>/dev/null || true
}

save_qr "$CREATE"
sleep 2
if [ ! -s "$QR_OUT" ]; then
  echo "=== CONNECT (segunda tentativa QR) ==="
  RESP=$(curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connect/$INST")
  save_qr "$RESP"
else
  RESP="$CREATE"
fi

if [ -s "$QR_OUT" ]; then
  echo "Escaneie: https://axecloud.com.br/ready-posts/autopost-qr.png"
  echo "Instruções: https://axecloud.com.br/ready-posts/parear.html"
  echo "QR expira ~60s — rode: bash deploy/scripts/refresh-autopost-qr-until-open.sh"
else
  echo "QR não gerado — resposta:"
  echo "$RESP" | head -c 500
fi

echo ""
echo "=== STATUS ==="
curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connectionState/$INST"
echo ""

grep -q '^EVOLUTION_AUTOPOST_INSTANCE=' .env \
  && sed -i "s|^EVOLUTION_AUTOPOST_INSTANCE=.*|EVOLUTION_AUTOPOST_INSTANCE=$INST|" .env \
  || echo "EVOLUTION_AUTOPOST_INSTANCE=$INST" >> .env
grep -q '^EVOLUTION_AUTOPOST_INTEGRATION=' .env \
  && sed -i 's|^EVOLUTION_AUTOPOST_INTEGRATION=.*|EVOLUTION_AUTOPOST_INTEGRATION=baileys|' .env \
  || echo 'EVOLUTION_AUTOPOST_INTEGRATION=baileys' >> .env
grep -q '^AUTOPOST_WHATSAPP_TO=' .env \
  && sed -i "s|^AUTOPOST_WHATSAPP_TO=.*|AUTOPOST_WHATSAPP_TO=$NUM|" .env \
  || echo "AUTOPOST_WHATSAPP_TO=$NUM" >> .env

echo "Após state=open, teste:"
echo "  docker compose -f deploy/docker-compose.yml --env-file .env exec -T app node scripts/facebookAutopost.js"
