#!/usr/bin/env bash
# Raspagem de terreiros na VPS (fora do Docker — Playwright precisa do Chromium no host).
#
# Uso (na VPS, em /opt/axecloud):
#   bash deploy/scripts/vps-scrape-diretorio.sh install     # 1ª vez: deps + Chromium
#   bash deploy/scripts/vps-scrape-diretorio.sh start-sp    # SP inteiro (retoma do progresso)
#   bash deploy/scripts/vps-scrape-diretorio.sh start-rj    # RJ pendentes (27 municípios)
#   bash deploy/scripts/vps-scrape-diretorio.sh enrich-sp   # preenche fotos/coords faltantes
#   bash deploy/scripts/vps-scrape-diretorio.sh status
#   bash deploy/scripts/vps-scrape-diretorio.sh stop
#   bash deploy/scripts/vps-scrape-diretorio.sh logs
#
# Logs: /var/log/axecloud-scrape-sp.log e /var/log/axecloud-scrape-rj.log
# PID:  /var/run/axecloud-scrape-sp.pid

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOG_SP="/var/log/axecloud-scrape-sp.log"
LOG_RJ="/var/log/axecloud-scrape-rj.log"
PID_SP="/var/run/axecloud-scrape-sp.pid"
PID_RJ="/var/run/axecloud-scrape-rj.pid"

die() { echo "ERRO: $*" >&2; exit 1; }

need_env() {
  if [[ ! -f .env ]]; then
    die "Arquivo .env ausente em $ROOT — copie do deploy/.env.vps.example"
  fi
  # shellcheck disable=SC1091
  set -a && source .env && set +a
  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" && -z "${SUPABASE_SERVICE_KEY:-}" ]]; then
    die "SUPABASE_SERVICE_ROLE_KEY ausente no .env"
  fi
}

install_deps() {
  echo ">>> Instalando dependências do sistema (Playwright/Chromium)…"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y --no-install-recommends \
      ca-certificates curl git \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0
  fi
  echo ">>> npm ci (produção + dev para playwright)…"
  npm ci
  echo ">>> Playwright Chromium…"
  npx playwright install chromium
  npx playwright install-deps chromium 2>/dev/null || true
  echo "OK — pronto para raspagem."
}

is_running() {
  local pidfile="$1"
  [[ -f "$pidfile" ]] || return 1
  local pid
  pid="$(cat "$pidfile")"
  kill -0 "$pid" 2>/dev/null
}

start_bg() {
  local name="$1"
  local pidfile="$2"
  local logfile="$3"
  shift 3
  if is_running "$pidfile"; then
    echo "Já em execução ($name) PID=$(cat "$pidfile")"
    return 0
  fi
  need_env
  echo ">>> Iniciando $name — log em $logfile"
  nohup "$@" >>"$logfile" 2>&1 &
  echo $! >"$pidfile"
  sleep 2
  if is_running "$pidfile"; then
    echo "OK $name PID=$(cat "$pidfile")"
  else
    echo "FALHOU — veja: tail -50 $logfile"
    rm -f "$pidfile"
    return 1
  fi
}

cmd="${1:-status}"

case "$cmd" in
  install)
    install_deps
    ;;
  start-sp)
    # Retoma automaticamente de scripts/data/sp-scrape-progress.json
    start_bg "SP" "$PID_SP" "$LOG_SP" \
      node scripts/run-raspagem-sp-completa.mjs --batch-size 15 --scroll-rounds 40 --headless true
    ;;
  start-rj)
    start_bg "RJ" "$PID_RJ" "$LOG_RJ" \
      node scripts/scrape-terreiros-google-maps.mjs \
        --cidades-file scripts/data/rj-municipios-pendentes.json \
        --scroll-rounds 40 --headless true
    ;;
  enrich-sp)
    start_bg "SP-enrich" "$PID_SP" "$LOG_SP" \
      node scripts/scrape-terreiros-google-maps.mjs \
        --enrich --cidades-file scripts/data/sp-municipios.json \
        --scroll-rounds 30 --headless true
    ;;
  stop)
    for f in "$PID_SP" "$PID_RJ"; do
      if is_running "$f"; then
        pid="$(cat "$f")"
        echo "Parando PID $pid…"
        kill "$pid" 2>/dev/null || true
        sleep 2
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$f"
      fi
    done
    echo "Parado."
    ;;
  status)
    echo "=== SP ==="
    if is_running "$PID_SP"; then echo "RODANDO PID=$(cat "$PID_SP")"; else echo "parado"; fi
    [[ -f scripts/data/sp-scrape-progress.json ]] && cat scripts/data/sp-scrape-progress.json
    echo ""
    echo "=== RJ ==="
    if is_running "$PID_RJ"; then echo "RODANDO PID=$(cat "$PID_RJ")"; else echo "parado"; fi
    ;;
  logs)
    echo "=== tail SP ===" && tail -30 "$LOG_SP" 2>/dev/null || echo "(sem log SP)"
    echo ""
    echo "=== tail RJ ===" && tail -30 "$LOG_RJ" 2>/dev/null || echo "(sem log RJ)"
    ;;
  *)
    echo "Uso: $0 {install|start-sp|start-rj|enrich-sp|status|stop|logs}"
    exit 1
    ;;
esac
