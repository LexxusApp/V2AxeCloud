#!/bin/bash
# Semana 2: anti-scanner (Caddy), healthcheck externo, scan opcional de imagens.
set -euo pipefail
cd /opt/axecloud

echo "[caddy] reload (anti-scanner + headers)"
docker compose -f deploy/docker-compose.yml --env-file .env up -d caddy
docker compose -f deploy/docker-compose.yml --env-file .env restart caddy

echo "[healthcheck] cron externo a cada 5 min"
chmod +x /opt/axecloud/deploy/scripts/vps-external-healthcheck.sh
sed -i 's/\r$//' /opt/axecloud/deploy/scripts/vps-external-healthcheck.sh 2>/dev/null || true
(crontab -l 2>/dev/null | grep -v vps-external-healthcheck
 echo "*/5 * * * * /opt/axecloud/deploy/scripts/vps-external-healthcheck.sh") | crontab -

echo "[healthcheck] teste imediato"
/opt/axecloud/deploy/scripts/vps-external-healthcheck.sh && tail -1 /var/log/axecloud-external-healthcheck.log

if command -v trivy >/dev/null 2>&1; then
  echo "[trivy] scan imagens (resumo HIGH/CRITICAL)"
  for img in deploy-app deploy-caddy deploy-evolution; do
    trivy image --severity HIGH,CRITICAL --ignore-unfixed --quiet "docker.io/library/${img}:latest" 2>/dev/null || true
  done
else
  echo "[trivy] não instalado — opcional: apt install trivy ou script em deploy/DEPLOY-VPS.md"
fi

echo "Semana 2 (VPS) aplicada."
