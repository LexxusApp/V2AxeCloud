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
  curl -sSL "${BASE}${path}" | grep -q "$needle" || {
    echo "FAIL ${path} — não contém: ${needle}"
    exit 1
  }
  echo "OK   ${path} — contém \"${needle}\""
}

echo "=== Smoke AxéCloud (${BASE}) ==="

check "/" "200"
check "/programa-fundador" "200"
check "/termos" "200"
check "/privacidade" "200"
check "/conteudo" "200"
check "/conteudo/glossario" "200"
check "/login" "200"
check "/register" "200"
check "/api/plans" "200"

check_contains "/" "m-assets/"
check_contains "/" "Sistema de gestão para terreiros"
check_contains "/login" "Entrar"
check_contains "/login" "/assets/"
curl -sSL "${BASE}/login" | grep -q 'm-assets/' && {
  echo "FAIL /login — não deve servir bundle de marketing (m-assets)"
  exit 1
} || echo "OK   /login — sem m-assets (app SPA)"

echo "=== Todos os testes passaram ==="
