#!/bin/bash
set -e
KEY="${EVOLUTION_API_KEY:?set EVOLUTION_API_KEY}"
INST="${1:-pairingtest999}"
NUM="${2:-5511912276156}"
BASE="${EVOLUTION_API_BASE_URL:-http://evolution:8080}"
H="apikey: $KEY"

curl -sS -X DELETE -H "$H" "$BASE/instance/logout/$INST" || true
curl -sS -X DELETE -H "$H" "$BASE/instance/delete/$INST" || true
sleep 3
echo "=== CREATE ==="
curl -sS -X POST -H "$H" -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"$INST\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":false,\"pairing\":true,\"number\":\"$NUM\"}" \
  "$BASE/instance/create"
echo ""
sleep 4
echo "=== CONNECT (once) ==="
curl -sS -H "$H" "$BASE/instance/connect/$INST?number=$NUM"
echo ""
