#!/bin/bash
# Atualiza código de pareamento a cada 45s até state=open, depois dispara autopost.
set -euo pipefail
cd /opt/axecloud

INST="${EVOLUTION_AUTOPOST_INSTANCE:-axecloud_autopost}"
NUM="${AUTOPOST_WHATSAPP_TO:-5511920033501}"
KEY="$(grep -m1 '^EVOLUTION_API_KEY=' .env | cut -d= -f2- | tr -d '\r')"
CODE_FILE="/opt/axecloud/assets/ready_posts/pairing-code.txt"
QR_OUT="/opt/axecloud/assets/ready_posts/autopost-qr.png"

curl_ev() {
  docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS "$@"
}

mkdir -p assets/ready_posts
echo "Pareamento por CÓDIGO — instância: $INST | número: $NUM"
echo "Instruções: https://axecloud.com.br/ready-posts/parear.html"
echo ""

while true; do
  STATE=$(curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connectionState/$INST" \
    | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.instance.state // .state // empty' 2>/dev/null || echo "")

  if [ "$STATE" = "open" ]; then
    echo "$(date -Iseconds) — CONECTADO. Disparando autopost…"
    docker compose -f deploy/docker-compose.yml --env-file .env exec -T app node scripts/facebookAutopost.js \
      && echo "Autopost enviado." || echo "Autopost falhou."
    echo "OK" > "$CODE_FILE"
    exit 0
  fi

  RESP=$(curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connect/$INST?number=$NUM")
  PAIR=$(echo "$RESP" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.pairingCode // empty' 2>/dev/null || true)
  TS=$(date -Iseconds)

  if [ -n "$PAIR" ] && [ "$PAIR" != "null" ]; then
    printf '%s\n%s\n%s\n' "$PAIR" "$NUM" "$TS" > "$CODE_FILE"
    echo "$TS — código: $PAIR (válido ~60s, state=${STATE:-connecting})"
  else
    echo "$TS — código não gerado (state=${STATE:-?})"
  fi

  echo "$RESP" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.base64 // empty' 2>/dev/null \
    | sed 's/^data:image\/png;base64,//' \
    | base64 -d > "$QR_OUT" 2>/dev/null || true

  sleep 45
done
