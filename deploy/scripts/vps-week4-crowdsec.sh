#!/bin/bash
# Semana 4: CrowdSec (WAF gratuito) + rebuild app/marketing com patches CVE.
set -euo pipefail
cd /opt/axecloud
ENV_FILE=/opt/axecloud/.env
COMPOSE="docker compose -f deploy/docker-compose.yml --env-file ${ENV_FILE}"

echo "[crowdsec] subir agente"
install -d -m 755 /var/log/caddy
$COMPOSE up -d crowdsec
sleep 8

echo "[crowdsec] aguardar LAPI"
for i in $(seq 1 30); do
  if $COMPOSE exec -T crowdsec cscli version >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! grep -q '^CROWDSEC_CADDY_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  echo "[crowdsec] gerar API key do bouncer Caddy"
  KEY=$($COMPOSE exec -T crowdsec cscli bouncers add caddy-bouncer -o raw 2>/dev/null | tr -d '\r\n')
  if [ -z "$KEY" ]; then
    echo "ERRO: não foi possível gerar CROWDSEC_CADDY_API_KEY" >&2
    exit 1
  fi
  echo "CROWDSEC_CADDY_API_KEY=$KEY" >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "[crowdsec] chave gravada em .env"
else
  echo "[crowdsec] CROWDSEC_CADDY_API_KEY já existe no .env"
fi

echo "[crowdsec] collections AppSec"
$COMPOSE exec -T crowdsec cscli collections install crowdsecurity/appsec-virtual-patching 2>/dev/null || true
$COMPOSE exec -T crowdsec cscli collections install crowdsecurity/appsec-generic-rules 2>/dev/null || true
$COMPOSE restart crowdsec
sleep 6

echo "[build] app + marketing + caddy (CVE patches + CrowdSec module)"
$COMPOSE build app marketing caddy
$COMPOSE up -d

echo "[validate] Caddy + CrowdSec"
sleep 5
$COMPOSE exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
$COMPOSE exec -T crowdsec cscli bouncers list | head -20
$COMPOSE ps crowdsec caddy app marketing

echo "Semana 4 (CrowdSec + CVE rebuild) aplicada."
