#!/bin/bash
# Cria/pareia instância Baileys dedicada ao autopost (envio livre de imagem + legenda).
set -euo pipefail
cd /opt/axecloud

INST="${EVOLUTION_AUTOPOST_INSTANCE:-axecloud_autopost}"
NUM="${AUTOPOST_WHATSAPP_TO:-5511920033501}"
KEY="$(grep -m1 '^EVOLUTION_API_KEY=' .env | cut -d= -f2- | tr -d '\r')"

curl_ev() {
  docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS "$@"
}

echo "Instância: $INST | número pareamento: $NUM"

curl_ev -X DELETE -H "apikey: $KEY" "http://evolution:8080/instance/logout/$INST" >/dev/null 2>&1 || true
curl_ev -X DELETE -H "apikey: $KEY" "http://evolution:8080/instance/delete/$INST" >/dev/null 2>&1 || true
sleep 2

echo "=== CREATE (Baileys + pairing) ==="
curl_ev -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"$INST\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":false,\"pairing\":true,\"number\":\"$NUM\"}" \
  "http://evolution:8080/instance/create"
echo ""

sleep 3
echo "=== CÓDIGO DE PAREAMENTO (WhatsApp → Aparelhos conectados → Conectar com número) ==="
curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connect/$INST?number=$NUM"
echo ""

sleep 2
echo "=== STATUS ==="
curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connectionState/$INST"
echo ""

grep -q '^EVOLUTION_AUTOPOST_INSTANCE=' .env \
  && sed -i "s|^EVOLUTION_AUTOPOST_INSTANCE=.*|EVOLUTION_AUTOPOST_INSTANCE=$INST|" .env \
  || echo "EVOLUTION_AUTOPOST_INSTANCE=$INST" >> .env
grep -q '^EVOLUTION_AUTOPOST_INTEGRATION=' .env \
  && sed -i 's|^EVOLUTION_AUTOPOST_INTEGRATION=.*|EVOLUTION_AUTOPOST_INTEGRATION=baileys|' .env \
  || echo 'EVOLUTION_AUTOPOST_INTEGRATION=baileys' >> .env

echo "Pronto. Após state=open, teste:"
echo "  docker compose -f deploy/docker-compose.yml --env-file .env exec -T app node scripts/facebookAutopost.js"
