#!/usr/bin/env bash
# Deploy seguro do stack de marketing + app + caddy com validação SEO.
# Rodar na VPS: bash deploy/scripts/deploy-seo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f deploy/docker-compose.yml --env-file .env"

echo "=== [1/5] Build marketing + app + caddy ==="
$COMPOSE build marketing app caddy

echo "=== [2/5] Subir containers ==="
$COMPOSE up -d marketing app caddy

echo "=== [3/5] Validar Caddyfile ==="
$COMPOSE exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "=== [4/5] Smoke rotas + SEO ==="
bash deploy/scripts/smoke-routes.sh
bash deploy/scripts/smoke-seo.sh

echo "=== [5/5] Notificar sitemap (opcional) ==="
if $COMPOSE exec -T app node scripts/submit-sitemap.mjs; then
  echo "Sitemap ping enviado."
else
  echo "Aviso: ping do sitemap falhou (normal — use Search Console manualmente)."
fi

echo ""
echo "Deploy SEO concluído."
echo "Search Console: envie https://axecloud.com.br/sitemap.xml (com .xml no final)"
echo "KPIs semanais: npm run seo:kpi-checklist  (docs/SEO-KPIS-SEARCH-CONSOLE.md)"
echo "Search Console: reenvie sitemap (20 URLs) e peça remoção de /programa-fundador (301 → /register)"
echo "Inspeção de URL: indexar /por-que-axecloud e artigos /conteudo/"
