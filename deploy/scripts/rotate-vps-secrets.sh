#!/bin/bash
# Rota CRON_SECRET e EVOLUTION_API_KEY no .env da VPS e reinicia app + evolution.
set -euo pipefail
cd /opt/axecloud
ENV_FILE=.env
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
chmod 600 "$ENV_FILE"

new_secret() { openssl rand -hex 32; }

rotate_key() {
  local key=$1
  local val=$2
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

CRON=$(new_secret)
EVO=$(new_secret)

rotate_key CRON_SECRET "$CRON"
rotate_key EVOLUTION_API_KEY "$EVO"

chmod 600 "$ENV_FILE"
docker compose -f deploy/docker-compose.yml --env-file .env up -d app evolution

echo "Secrets rotacionados. Backup em ${ENV_FILE}.bak.*"
echo "CRON_SECRET e EVOLUTION_API_KEY atualizados — app e evolution reiniciados."
