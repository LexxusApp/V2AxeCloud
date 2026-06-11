#!/bin/bash
# Scan de CVEs nas imagens Docker do stack (HIGH/CRITICAL).
set -euo pipefail
LOG=/var/log/axecloud-trivy.log
TS=$(date -Iseconds)
cd /opt/axecloud

if ! command -v trivy >/dev/null 2>&1; then
  echo "$TS SKIP trivy not installed" >> "$LOG"
  exit 0
fi

{
  echo "=== $TS ==="
  for img in deploy-app deploy-caddy deploy-marketing; do
    echo "--- $img ---"
    trivy image --severity HIGH,CRITICAL --ignore-unfixed --quiet "docker.io/library/${img}:latest" 2>/dev/null || echo "(imagem ${img} nao encontrada localmente)"
  done
  trivy image --severity HIGH,CRITICAL --ignore-unfixed --quiet evoapicloud/evolution-api:v2.3.7 2>/dev/null || true
} >> "$LOG" 2>&1

tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
echo "$TS OK scan" >> "$LOG"
