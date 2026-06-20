#!/bin/bash
# Gera novo código/QR de pareamento sem recriar a instância.
set -euo pipefail
cd /opt/axecloud
INST="${EVOLUTION_AUTOPOST_INSTANCE:-axecloud_autopost}"
NUM="${AUTOPOST_WHATSAPP_TO:-5511920033501}"
KEY="$(grep -m1 '^EVOLUTION_API_KEY=' .env | cut -d= -f2- | tr -d '\r')"

curl_ev() {
  docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS "$@"
}

mkdir -p assets/ready_posts
OUT="/opt/axecloud/assets/ready_posts/pairing-qr.png"

echo "Instância: $INST | número: $NUM"
echo "=== NOVO CÓDIGO (válido ~60s) ==="
RESP=$(curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connect/$INST?number=$NUM")
echo "$RESP" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.pairingCode // empty' 2>/dev/null || echo "$RESP" | grep -o '"pairingCode":"[^"]*"' | cut -d'"' -f4

echo "$RESP" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.base64 // empty' 2>/dev/null \
  | sed 's/^data:image\/png;base64,//' \
  | base64 -d > "$OUT" 2>/dev/null || true

if [ -s "$OUT" ]; then
  echo "QR salvo: https://axecloud.com.br/ready-posts/pairing-qr.png"
fi

echo "=== STATUS ==="
curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connectionState/$INST"
echo
