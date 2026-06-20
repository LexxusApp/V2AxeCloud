#!/usr/bin/env bash
# Auditoria de segurança — últimas N horas (padrão 48). Rodar na VPS como root.
set -uo pipefail
HOURS="${1:-48}"

section() { echo ""; echo "========== $1 =========="; }

section "SERVIDOR ($(date -u '+%Y-%m-%d %H:%M UTC')) — janela ${HOURS}h"
hostname
uptime
free -h | head -2
echo "Disco:"
df -h / /var/log 2>/dev/null | tail -n +2

section "DOCKER STACK"
cd /opt/axecloud 2>/dev/null && docker compose -f deploy/docker-compose.yml --env-file .env ps 2>/dev/null || docker ps --format 'table {{.Names}}\t{{.Status}}'

section "FAIL2BAN"
fail2ban-client status 2>/dev/null || true
for jail in sshd caddy-scanner; do
  echo "--- jail: $jail ---"
  fail2ban-client status "$jail" 2>/dev/null || echo "ausente"
done
SINCE_DATE=$(date -d "${HOURS} hours ago" '+%Y-%m-%d' 2>/dev/null || date -u -v-${HOURS}H '+%Y-%m-%d' 2>/dev/null)
echo "--- bans/unbans desde ${SINCE_DATE} ---"
awk -v since="$SINCE_DATE" '$0 >= since' /var/log/fail2ban.log 2>/dev/null | grep -E 'Ban|Unban' | tail -40 || true

section "UFW + SSH HARDENING"
ufw status numbered 2>/dev/null | head -15
sshd -T 2>/dev/null | grep -iE 'passwordauthentication|permitrootlogin|pubkeyauthentication|maxauthtries'

section "SSH (48h)"
python3 - <<PY
import re
from collections import Counter
from datetime import datetime, timedelta

hours = ${HOURS}
cutoff = datetime.now().astimezone() - timedelta(hours=hours)
pat = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})')
invalid_users = Counter()
invalid_ips = Counter()
failed_pw = 0
accepted = Counter()
lines = 0
try:
    with open('/var/log/auth.log', encoding='utf-8', errors='replace') as f:
        for line in f:
            m = pat.match(line)
            if not m:
                continue
            ts = datetime.fromisoformat(m.group(1))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=cutoff.tzinfo)
            if ts < cutoff:
                continue
            lines += 1
            if 'Invalid user' in line:
                u = line.split('Invalid user', 1)[1].split(' from', 1)[0].strip() or '(vazio)'
                invalid_users[u] += 1
                ip = line.rsplit(' from ', 1)[-1].split(' port')[0].strip()
                invalid_ips[ip] += 1
            elif 'Failed password' in line:
                failed_pw += 1
            elif 'Accepted publickey' in line:
                ip = line.rsplit(' from ', 1)[-1].split(' port')[0].strip()
                accepted[ip] += 1
except FileNotFoundError:
    print('auth.log ausente')
    raise SystemExit
print(f'Linhas sshd na janela: {lines}')
print(f'Falhas de senha: {failed_pw}')
print(f'Usuarios invalidos: {sum(invalid_users.values())}')
print(f'Logins OK (chave): {sum(accepted.values())}')
print('Top usuarios invalidos:')
for u, n in invalid_users.most_common(8):
    print(f'  {n:4d}  {u}')
print('Top IPs SSH invalidos:')
for ip, n in invalid_ips.most_common(10):
    print(f'  {n:4d}  {ip}')
print('Logins legitimos (chave):')
for ip, n in accepted.most_common(5):
    print(f'  {n:4d}  {ip}')
PY

section "CROWDSEC"
if docker ps --format '{{.Names}}' | grep -q crowdsec; then
  COMPOSE="docker compose -f /opt/axecloud/deploy/docker-compose.yml --env-file /opt/axecloud/.env"
  echo "Decisoes ativas:"
  $COMPOSE exec -T crowdsec cscli decisions list 2>/dev/null | head -15 || true
  echo "Alertas recentes:"
  $COMPOSE exec -T crowdsec cscli alerts list -l 20 2>/dev/null || true
  echo "AppSec bloqueados (metricas):"
  $COMPOSE exec -T crowdsec cscli metrics 2>/dev/null | grep -A6 'Appsec Metrics' || true
fi

section "CADDY + TRAFEGO HTTP (48h)"
python3 - <<PY
import json, re
from collections import Counter, defaultdict
from datetime import datetime, timedelta

hours = ${HOURS}
cutoff = datetime.utcnow().timestamp() - hours * 3600
log = '/var/log/caddy/access.log'
status = Counter()
methods = Counter()
scanners = Counter()
blocked_ips = Counter()
rate_limited = Counter()
errors5 = Counter()
paths = Counter()
ip_hits = Counter()
hourly = Counter()
scanner_re = re.compile(r'\.env|wp-admin|phpmyadmin|wp-login|\.git|xmlrpc|vendor/phpunit|actuator|containers/json', re.I)
total = in_window = 0
max_ip = ('', 0)

try:
    with open(log, encoding='utf-8', errors='replace') as f:
        for line in f:
            total += 1
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = d.get('ts')
            if ts is None or ts < cutoff:
                continue
            in_window += 1
            req = d.get('request', {})
            st = d.get('status', 0)
            uri = req.get('uri', '')
            method = req.get('method', '?')
            hdrs = req.get('headers') or {}
            ip = (hdrs.get('Cf-Connecting-Ip') or ['?'])[0]
            status[st] += 1
            methods[method] += 1
            paths[uri.split('?')[0]] += 1
            ip_hits[ip] += 1
            hour = datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d %H:00 UTC')
            hourly[hour] += 1
            if st == 429:
                rate_limited[ip] += 1
            if st >= 500:
                errors5[f'{st} {uri}'] += 1
            if st >= 403:
                blocked_ips[f'{ip} {st}'] += 1
            if scanner_re.search(uri):
                scanners[f'{ip} -> {uri} [{st}]'] += 1
except FileNotFoundError:
    print('Log ausente:', log)
    raise SystemExit

if ip_hits:
    max_ip = ip_hits.most_common(1)[0]

print(f'Total linhas log: {total}')
print(f'Requisicoes na janela {hours}h: {in_window}')
if in_window:
    print(f'Media/hora: {in_window / hours:.1f}')
print(f'Pico horario: {hourly.most_common(1)[0] if hourly else ("n/a", 0)}')
print(f'IP mais ativo: {max_ip[0]} ({max_ip[1]} reqs)')
if max_ip[1] > 500:
    print('  [!] Volume alto de um IP — possivel scan ou DDoS leve (mitigado pela CF/Caddy)')
print('Status HTTP:')
for code, n in sorted(status.items(), key=lambda x: (-x[1], x[0]))[:12]:
    print(f'  {code}: {n}')
print(f'Rate limit 429: {sum(rate_limited.values())} eventos')
if rate_limited:
    for k, n in rate_limited.most_common(8):
        print(f'  {n}x {k}')
print(f'Erros 5xx: {sum(errors5.values())}')
if errors5:
    for k, n in errors5.most_common(5):
        print(f'  {n}x {k}')
print(f'Tentativas scanner: {sum(scanners.values())}')
for k, n in scanners.most_common(12):
    print(f'  {n}x {k}')
print('Top paths (nao-scanner):')
for p, n in paths.most_common(15):
    if not scanner_re.search(p):
        print(f'  {n:4d}  {p}')
PY

section "HEALTHCHECKS (48h)"
for f in /var/log/axecloud-healthcheck.log /var/log/axecloud-external-healthcheck.log; do
  [ -f "$f" ] || continue
  echo "--- $f ---"
  fails=$(grep -c FAIL "$f" 2>/dev/null || echo 0)
  oks=$(grep -c OK "$f" 2>/dev/null || echo 0)
  echo "OK=$oks FAIL=$fails (arquivo inteiro; cron 5min ~576 checks/48h)"
  tail -5 "$f"
done

section "INDICADORES DE COMPROMETIMENTO"
echo "Usuarios com shell:"
awk -F: '$3>=1000 && $7 !~ /nologin|false/ {print $1, $7}' /etc/passwd
echo "Cron root:"
crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' || true
echo "Processos suspeitos:"
ps aux | grep -Ei 'xmr|miner|kinsing|masscan|sqlmap' | grep -v grep || echo 'nenhum'
echo "Portas publicas:"
ss -tlnp | grep -E ':22|:80|:443|:19999' || true

section "CLOUDFLARE WAF (regra scanner)"
if [ -f /opt/axecloud/.env ]; then
  source <(grep -E '^CLOUDFLARE_' /opt/axecloud/.env | sed 's/\r$//')
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    ZONE_ID=$(curl -sS "https://api.cloudflare.com/client/v4/zones?name=axecloud.com.br" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('success') and d.get('result') else '')" 2>/dev/null)
    if [ -n "$ZONE_ID" ]; then
      curl -sS "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if not d.get('success'):
    print('WAF entrypoint:', d.get('errors'))
else:
    for r in d.get('result',{}).get('rules',[]):
        print('Regra:', r.get('description'), '| action:', r.get('action'), '| enabled:', r.get('enabled'))
" 2>/dev/null || echo 'nao foi possivel consultar WAF'
    fi
  fi
fi

section "FIM AUDITORIA ${HOURS}h"
