#!/usr/bin/env bash
# Smoke test — marketing vs app no mesmo domínio (rodar na VPS ou com BASE_URL).
set -euo pipefail

BASE="${BASE_URL:-https://axecloud.com.br}"

check() {
  local path="$1"
  local expect="$2"
  local code
  code="$(curl -sSL -o /tmp/smoke-body.html -w '%{http_code}' "${BASE}${path}")"
  if [[ "$code" != "$expect" ]]; then
    echo "FAIL ${path} — HTTP ${code} (esperado ${expect})"
    exit 1
  fi
  echo "OK   ${path} — ${code}"
}

check_contains() {
  local path="$1"
  local needle="$2"
  local tmp
  tmp="$(mktemp)"
  curl -sSL "${BASE}${path}" -o "$tmp"
  grep -qi "$needle" "$tmp" || {
    rm -f "$tmp"
    echo "FAIL ${path} — não contém: ${needle}"
    exit 1
  }
  rm -f "$tmp"
  echo "OK   ${path} — contém \"${needle}\""
}

echo "=== Smoke AxéCloud (${BASE}) ==="

check "/" "200"
check "/programa-fundador" "200"
check "/termos" "200"
check "/privacidade" "200"
check "/conteudo" "200"
check "/conteudo/glossario" "200"
check "/espaco-do-fiel" "200"
check "/terreiros" "200"
check "/eventos" "200"
check "/conteudo/calendario-liturgico" "200"
check "/login" "200"
check "/register" "200"
check "/api/plans" "200"
check "/api/v1/public/terreiros" "200"
check "/api/v1/public/eventos" "200"
check "/sitemap.xml" "200"
check "/robots.txt" "200"

check_contains "/" "m-assets/"
check_contains "/" "Gestão de terreiros"
check_contains "/programa-fundador" "Programa Fundador"
check_contains "/terreiros" "Diretório"
check_contains "/eventos" "Eventos"
check_contains "/login" "Entrar"
check_contains "/login" "/assets/"
curl -sSL "${BASE}/login" | grep -q 'm-assets/' && {
  echo "FAIL /login — não deve servir bundle de marketing (m-assets)"
  exit 1
} || echo "OK   /login — sem m-assets (app SPA)"

echo "=== Rotas OK — rode também: bash deploy/scripts/smoke-seo.sh ==="
