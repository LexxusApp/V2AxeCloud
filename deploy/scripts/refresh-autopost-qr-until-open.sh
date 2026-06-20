#!/bin/bash
# Atualiza o QR a cada 45s até a instância Baileys ficar open (Ctrl+C para parar).
set -euo pipefail
cd /opt/axecloud

INST="${EVOLUTION_AUTOPOST_INSTANCE:-axecloud_autopost}"
KEY="$(grep -m1 '^EVOLUTION_API_KEY=' .env | cut -d= -f2- | tr -d '\r')"
QR_OUT="/opt/axecloud/assets/ready_posts/autopost-qr.png"

curl_ev() {
  docker run --rm --network deploy_web curlimages/curl:8.5.0 -sS "$@"
}

save_qr() {
  local resp="$1"
  echo "$resp" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.qrcode.base64 // .base64 // empty' 2>/dev/null \
    | sed 's/^data:image\/png;base64,//' \
    | base64 -d > "$QR_OUT" 2>/dev/null || true
}

mkdir -p assets/ready_posts
echo "Aguardando pareamento de $INST — QR: https://axecloud.com.br/ready-posts/autopost-qr.png"
echo "Página com instruções: https://axecloud.com.br/ready-posts/parear.html"
echo ""

while true; do
  STATE=$(curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connectionState/$INST" \
    | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.instance.state // .state // empty' 2>/dev/null || echo "")

  if [ "$STATE" = "open" ]; then
    echo "$(date -Iseconds) — CONECTADO (state=open). Disparando autopost…"
    docker compose -f deploy/docker-compose.yml --env-file .env exec -T app node scripts/facebookAutopost.js \
      && echo "Autopost enviado com sucesso." \
      || echo "Autopost falhou — veja logs acima."
    exit 0
  fi

  RESP=$(curl_ev -H "apikey: $KEY" "http://evolution:8080/instance/connect/$INST")
  save_qr "$RESP"
  PAIR=$(echo "$RESP" | docker run --rm -i ghcr.io/jqlang/jq:latest -r '.pairingCode // empty' 2>/dev/null || true)

  if [ -s "$QR_OUT" ]; then
    echo "$(date -Iseconds) — QR atualizado (state=${STATE:-connecting})"
  else
    echo "$(date -Iseconds) — QR não gerado (state=${STATE:-?})"
  fi
  if [ -n "$PAIR" ] && [ "$PAIR" != "null" ]; then
    echo "  Código de pareamento (WhatsApp → Aparelhos conectados → Conectar com número): $PAIR"
  fi

  sleep 45
done
