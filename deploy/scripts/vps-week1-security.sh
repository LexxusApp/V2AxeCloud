#!/bin/bash
# Pacote Semana 1: swap, healthcheck cron, Caddy reload (headers já no Caddyfile).
set -euo pipefail
cd /opt/axecloud

echo "[swap] 2G se ausente"
if [ "$(swapon --show | wc -l)" -le 1 ]; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap 2G ativado"
else
  echo "Swap já configurado"
fi

echo "[healthcheck] cron a cada 5 min"
chmod +x /opt/axecloud/deploy/scripts/vps-healthcheck.sh
sed -i 's/\r$//' /opt/axecloud/deploy/scripts/vps-healthcheck.sh 2>/dev/null || true
(crontab -l 2>/dev/null | grep -v vps-healthcheck; echo "*/5 * * * * /opt/axecloud/deploy/scripts/vps-healthcheck.sh") | crontab -

echo "[caddy] reload config"
docker compose -f deploy/docker-compose.yml --env-file .env up -d caddy

echo "Semana 1 (VPS) aplicada."
