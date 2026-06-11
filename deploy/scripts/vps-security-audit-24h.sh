#!/usr/bin/env bash
# Auditoria de segurança das últimas 24h — rodar na VPS como root.
set -euo pipefail

HOURS="${1:-24}"
SINCE_EPOCH=$(date -u -d "${HOURS} hours ago" +%s 2>/dev/null || echo 0)

section() { echo ""; echo "========== $1 =========="; }

section "SERVIDOR"
hostname
uptime
date -u

section "DOCKER STACK"
cd /opt/axecloud 2>/dev/null && docker compose -f deploy/docker-compose.yml ps || docker ps

section "FAIL2BAN"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status || true
  for jail in sshd caddy-scanner; do
    echo "--- $jail ---"
    fail2ban-client status "$jail" 2>/dev/null || echo "jail $jail ausente"
  done
  echo "--- banidos recentes (fail2ban.log) ---"
  grep -E "Ban|Unban" /var/log/fail2ban.log 2>/dev/null | tail -30 || true
else
  echo "fail2ban nao instalado"
fi

section "UFW"
ufw status verbose 2>/dev/null | head -20 || true

section "SSH HARDENING"
sshd -T 2>/dev/null | grep -iE 'passwordauthentication|permitrootlogin|pubkeyauthentication|maxauthtries' || true

section "SSH TENTATIVAS 24H"
if [ -f /var/log/auth.log ]; then
  echo "Falhas de senha:"
  grep -c "Failed password" /var/log/auth.log 2>/dev/null || echo 0
  echo "Usuarios invalidos:"
  grep -c "Invalid user" /var/log/auth.log 2>/dev/null || echo 0
  echo "Logins aceitos (chave):"
  grep -c "Accepted publickey" /var/log/auth.log 2>/dev/null || echo 0
  echo "Top usuarios invalidos:"
  grep "Invalid user" /var/log/auth.log 2>/dev/null | sed 's/.*Invalid user //' | sed 's/ from.*//' | sort | uniq -c | sort -rn | head -10
  echo "Ultimas 15 linhas relevantes:"
  grep -E "Failed password|Invalid user|Accepted publickey|Ban " /var/log/auth.log 2>/dev/null | tail -15
else
  echo "auth.log ausente"
fi

section "CROWDSEC"
if docker ps --format '{{.Names}}' | grep -q crowdsec; then
  COMPOSE="docker compose -f /opt/axecloud/deploy/docker-compose.yml"
  $COMPOSE exec -T crowdsec cscli decisions list -o raw 2>/dev/null | head -20 || echo "sem decisoes ativas"
  echo "--- alertas recentes ---"
  $COMPOSE exec -T crowdsec cscli alerts list -l 15 2>/dev/null || true
  echo "--- metricas ---"
  $COMPOSE exec -T crowdsec cscli metrics 2>/dev/null | head -25 || true
else
  echo "crowdsec nao esta rodando"
fi

section "CADDY LOGS 24H"
LOG=/var/log/caddy/access.log
if [ -f "$LOG" ] && command -v jq >/dev/null 2>&1; then
  echo "Total linhas no log:"
  wc -l < "$LOG"
  echo "Requisicoes ultimas 24h:"
  jq -r --argjson since "$SINCE_EPOCH" '
    select(.ts != null) |
    select((.ts | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) >= $since) |
    .status
  ' "$LOG" 2>/dev/null | wc -l
  echo "Scanners bloqueados 404:"
  jq -r --argjson since "$SINCE_EPOCH" '
    select(.ts != null) |
    select((.ts | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) >= $since) |
    select(.request.uri | test("/(\\.env|wp-admin|phpmyadmin|wp-login|\\.git|xmlrpc|vendor/phpunit|actuator)")) |
    "\(.request.headers.\"Cf-Connecting-Ip\"[0] // .request.remote_ip // "?") \(.status) \(.request.uri)"
  ' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -20
  echo "HTTP 429 rate limit:"
  jq -r --argjson since "$SINCE_EPOCH" '
    select(.ts != null) |
    select((.ts | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) >= $since) |
    select(.status == 429) |
    "\(.request.headers.\"Cf-Connecting-Ip\"[0] // .request.remote_ip) \(.request.uri)"
  ' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -15
  echo "Top IPs com 403+:"
  jq -r --argjson since "$SINCE_EPOCH" '
    select(.ts != null) |
    select((.ts | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) >= $since) |
    select(.status >= 403) |
    "\(.request.headers.\"Cf-Connecting-Ip\"[0] // .request.remote_ip // "?") \(.status)"
  ' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -15
  echo "Top 5xx:"
  jq -r --argjson since "$SINCE_EPOCH" '
    select(.ts != null) |
    select((.ts | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) >= $since) |
    select(.status >= 500) |
    "\(.status) \(.request.uri)"
  ' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn | head -10
elif [ -f "$LOG" ]; then
  echo "jq ausente - amostra grep:"
  grep -E 'wp-admin|\.env|phpmyadmin' "$LOG" | tail -20
else
  echo "log ausente em $LOG"
  ls -la /var/log/caddy/ 2>/dev/null || true
fi

section "HEALTHCHECKS"
for f in /var/log/axecloud-healthcheck.log /var/log/axecloud-external-healthcheck.log; do
  if [ -f "$f" ]; then
    echo "--- $f (ultimas 10) ---"
    tail -10 "$f"
    echo "Falhas 24h:"
    grep -c FAIL "$f" 2>/dev/null || echo 0
  fi
done

section "TRIVY ULTIMO SCAN"
if [ -f /var/log/axecloud-trivy.log ]; then
  tail -30 /var/log/axecloud-trivy.log
else
  echo "sem log trivy"
fi

section "PORTAS ABERTAS"
ss -tlnp | grep -E ':22|:80|:443|:3000|:8080|:19999' || true

section "FIM AUDITORIA"
