#!/bin/bash
# Semana 3: rate limit Caddy (build custom), logs de acesso, fail2ban HTTP, Trivy.
set -euo pipefail
cd /opt/axecloud

echo "[log] diretório de acesso Caddy"
install -d -m 755 /var/log/caddy

echo "[healthcheck] permissões executáveis"
chmod +x /opt/axecloud/deploy/scripts/vps-healthcheck.sh
chmod +x /opt/axecloud/deploy/scripts/vps-external-healthcheck.sh
sed -i 's/\r$//' /opt/axecloud/deploy/scripts/vps-healthcheck.sh 2>/dev/null || true
sed -i 's/\r$//' /opt/axecloud/deploy/scripts/vps-external-healthcheck.sh 2>/dev/null || true

echo "[caddy] build imagem com rate limit + up"
docker compose -f deploy/docker-compose.yml --env-file .env build caddy
docker compose -f deploy/docker-compose.yml --env-file .env up -d caddy
sleep 3
docker compose -f deploy/docker-compose.yml exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "[fail2ban] jail caddy-scanner"
install -m 644 /opt/axecloud/deploy/fail2ban/caddy-scanner.conf /etc/fail2ban/filter.d/caddy-scanner.conf
install -m 644 /opt/axecloud/deploy/fail2ban/jail-caddy.local /etc/fail2ban/jail.d/caddy-scanner.local
systemctl restart fail2ban
fail2ban-client status caddy-scanner 2>/dev/null || true

echo "[trivy] instalacao"
export DEBIAN_FRONTEND=noninteractive
if ! command -v trivy >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq wget gnupg
  wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /usr/share/keyrings/trivy.gpg
  echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" > /etc/apt/sources.list.d/trivy.list
  apt-get update -qq
  apt-get install -y -qq trivy
fi
trivy --version

echo "[trivy] scan inicial (HIGH/CRITICAL)"
chmod +x /opt/axecloud/deploy/scripts/vps-trivy-scan.sh
sed -i 's/\r$//' /opt/axecloud/deploy/scripts/vps-trivy-scan.sh 2>/dev/null || true
/opt/axecloud/deploy/scripts/vps-trivy-scan.sh || true

echo "[trivy] cron mensal (dia 1, 03:00)"
(crontab -l 2>/dev/null | grep -v vps-trivy-scan
 echo "0 3 1 * * /opt/axecloud/deploy/scripts/vps-trivy-scan.sh") | crontab -

echo "Semana 3 (VPS) aplicada."
