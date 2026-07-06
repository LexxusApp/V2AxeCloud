#!/bin/bash
# Auditoria semanal VPS — somente leitura (logs Caddy em JSON)
LOG=/var/log/caddy/access.log

echo "=== CADDY HTTP STATUS (current log) ==="
if [ -f "$LOG" ]; then
  for code in 200 301 302 403 404 429 500 502 503; do
    n=$(grep -c "\"status\":${code}" "$LOG" 2>/dev/null || echo 0)
    echo "status_${code}=${n}"
  done
  echo "scan_probes=$(grep -ciE 'wp-admin|\.env|phpmyadmin|xmlrpc|/\.git|/wp-' "$LOG" 2>/dev/null || echo 0)"
  echo "log_lines=$(wc -l < "$LOG")"
  echo "log_size=$(du -h "$LOG" | cut -f1)"
fi

echo "=== CADDY HTTP STATUS (rotated gz, 7d window) ==="
for f in /var/log/caddy/access-*.gz; do
  [ -f "$f" ] || continue
  s502=$(zgrep -c '"status":502' "$f" 2>/dev/null || echo 0)
  s503=$(zgrep -c '"status":503' "$f" 2>/dev/null || echo 0)
  echo "$(basename "$f") 502=${s502} 503=${s503}"
done

echo "=== TOP REMOTE IPs (current log, excl Cloudflare edge sample) ==="
grep -oE '"client_ip":"[0-9.]+"' "$LOG" 2>/dev/null | sed 's/"client_ip":"//;s/"$//' | sort | uniq -c | sort -rn | head -12

echo "=== FAIL2BAN ==="
fail2ban-client status sshd 2>/dev/null | grep -E 'Currently banned|Total banned|Total failed'
fail2ban-client status caddy-scanner 2>/dev/null | grep -E 'Currently banned|Total banned'

echo "=== CONTAINERS ==="
docker ps --format '{{.Names}} | {{.Status}}'
for c in deploy-app-1 deploy-caddy-1 deploy-marketing-1 deploy-admin-1; do
  docker inspect "$c" --format '{{.Name}} restarts={{.RestartCount}}' 2>/dev/null
done

echo "=== HEALTH ==="
curl -s -o /dev/null -w "health=%{http_code} time=%{time_total}s\n" https://axecloud.com.br/api/health-check

echo "=== GIT ==="
cd /opt/axecloud && git log -1 --oneline
