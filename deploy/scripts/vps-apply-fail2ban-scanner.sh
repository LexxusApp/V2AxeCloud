#!/usr/bin/env bash
# Aplica filtro fail2ban caddy-scanner (403+404, Cf-Connecting-Ip). Rodar na VPS como root.
set -euo pipefail
cd /opt/axecloud

echo "[fail2ban] instalar filtro caddy-scanner v2"
install -m 644 deploy/fail2ban/caddy-scanner.conf /etc/fail2ban/filter.d/caddy-scanner.conf
install -m 644 deploy/fail2ban/jail-caddy.local /etc/fail2ban/jail.d/caddy-scanner.local

echo "[fail2ban] testar regex no log atual"
fail2ban-regex /var/log/caddy/access.log /etc/fail2ban/filter.d/caddy-scanner.conf | tail -20

echo "[fail2ban] reload"
systemctl restart fail2ban
sleep 2
fail2ban-client status caddy-scanner

echo "fail2ban caddy-scanner atualizado."
