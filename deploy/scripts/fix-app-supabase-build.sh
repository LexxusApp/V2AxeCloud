#!/usr/bin/env bash
# Corrige login quando o bundle do app foi buildado sem VITE_SUPABASE_*.
# Rodar NA VPS: bash deploy/scripts/fix-app-supabase-build.sh
set -euo pipefail
cd /opt/axecloud

if [[ ! -f .env ]]; then
  echo "ERRO: /opt/axecloud/.env não encontrado."
  exit 1
fi

# shellcheck disable=SC1091
source .env

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  echo "ERRO: Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env antes do build."
  exit 1
fi

echo "Rebuild do container app (com credenciais Supabase)..."
docker compose -f deploy/docker-compose.yml --env-file .env build app --no-cache
docker compose -f deploy/docker-compose.yml --env-file .env up -d app

echo "OK. Teste: curl -s https://axecloud.com.br/api/ping"
curl -fsS "https://axecloud.com.br/api/ping" || true
echo ""
echo "Abra https://axecloud.com.br/login em aba anónima e tente entrar."
