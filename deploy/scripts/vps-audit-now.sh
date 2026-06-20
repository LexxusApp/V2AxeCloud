#!/usr/bin/env bash
set -uo pipefail
HOURS="${1:-72}"

section() { echo ""; echo "========== $1 =========="; }

section "SERVIDOR $(date -u '+%Y-%m-%d %H:%M UTC') — janela ${HOURS}h"
hostname
uptime
free -h | head -2
df -h / /var/log 2>/dev/null | tail -n +2

section "DOCKER STACK"
cd /opt/axecloud 2>/dev/null && docker compose -f deploy/docker-compose.yml --env-file .env ps 2>/dev/null
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}' 2>/dev/null

section "TOP CPU"
ps aux --sort=-%cpu | head -12

section "FAIL2BAN"
fail2ban-client status 2>/dev/null || echo "fail2ban off"
for jail in sshd caddy-scanner caddy-http-auth; do
  echo "--- jail: $jail ---"
  fail2ban-client status "$jail" 2>/dev/null || echo "ausente"
done
echo "--- bans recentes ---"
grep -E 'Ban|Unban' /var/log/fail2ban.log 2>/dev/null | tail -30 || true

section "UFW"
ufw status numbered 2>/dev/null | head -20 || true

section "SSH AUTH"
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
for path in ['/var/log/auth.log']:
    try:
        f = open(path, encoding='utf-8', errors='replace')
    except FileNotFoundError:
        continue
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
print(f'Linhas sshd: {lines}')
print(f'Falhas de senha: {failed_pw}')
print(f'Usuarios invalidos: {sum(invalid_users.values())}')
print(f'Logins OK (chave): {sum(accepted.values())}')
print('Top usuarios invalidos:')
for u, n in invalid_users.most_common(8):
    print(f'  {n:4d}  {u}')
print('Top IPs SSH invalidos:')
for ip, n in invalid_ips.most_common(10):
    print(f'  {n:4d}  {ip}')
print('Logins legitimos:')
for ip, n in accepted.most_common(5):
    print(f'  {n:4d}  {ip}')
PY

section "CROWDSEC"
if docker ps --format '{{.Names}}' | grep -q crowdsec; then
  COMPOSE="docker compose -f /opt/axecloud/deploy/docker-compose.yml --env-file /opt/axecloud/.env"
  echo "Decisoes ativas:"
  $COMPOSE exec -T crowdsec cscli decisions list 2>/dev/null | head -20 || true
  echo "Alertas recentes:"
  $COMPOSE exec -T crowdsec cscli alerts list -l 15 2>/dev/null || true
  echo "Metricas AppSec:"
  $COMPOSE exec -T crowdsec cscli metrics 2>/dev/null | grep -A8 'Appsec Metrics' || true
fi

section "CADDY HTTP"
python3 - <<PY
import json, re
from collections import Counter
from datetime import datetime, timedelta

hours = ${HOURS}
cutoff = datetime.utcnow().timestamp() - hours * 3600
log = '/var/log/caddy/access.log'
status = Counter()
scanners = Counter()
rate_limited = Counter()
errors5 = Counter()
paths = Counter()
ip_hits = Counter()
hourly = Counter()
scanner_re = re.compile(
    r'\.env|wp-admin|phpmyadmin|wp-login|\.git|xmlrpc|vendor/phpunit|actuator|containers/json|/admin\.php|/shell',
    re.I,
)
total = win = 0

try:
    with open(log, encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = rec.get('ts') or rec.get('time') or ''
            try:
                if isinstance(ts, (int, float)):
                    t = ts / 1000 if ts > 1e12 else ts
                else:
                    t = datetime.fromisoformat(str(ts).replace('Z', '+00:00')).timestamp()
            except Exception:
                t = 0
            if t and t < cutoff:
                continue
            win += 1
            st = str(rec.get('status', '?'))
            status[st] += 1
            if st.startswith('5'):
                errors5[st] += 1
            uri = str(rec.get('uri') or rec.get('request', {}).get('uri') or '/')
            paths[uri.split('?')[0][:80]] += 1
            ip = rec.get('remote_ip') or rec.get('request', {}).get('remote_ip') or '?'
            ip_hits[ip] += 1
            if scanner_re.search(uri):
                scanners[ip] += 1
            if st in ('429', '403'):
                rate_limited[ip] += 1
            if t:
                hourly[datetime.utcfromtimestamp(t).strftime('%m-%d %Hh')] += 1
except FileNotFoundError:
    print('access.log ausente')
    raise SystemExit

print(f'Requisicoes na janela: {win} (log total: {total})')
print('Status HTTP:', status.most_common(12))
print('Erros 5xx:', dict(errors5))
print('Bloqueios 403/429 por IP:', rate_limited.most_common(10))
print('Scanners por IP:', scanners.most_common(10))
print('Top IPs:', ip_hits.most_common(12))
print('Top paths:', paths.most_common(12))
print('Picos por hora:', sorted(hourly.items(), key=lambda x: -x[1])[:10])
PY

section "OOM / KERNEL"
dmesg -T 2>/dev/null | grep -iE 'oom|kill|out of memory' | tail -10 || journalctl -k --since "${HOURS} hours ago" 2>/dev/null | grep -iE 'oom|kill' | tail -10 || true

section "REDIS / EVOLUTION"
docker exec deploy-redis-1 redis-cli INFO stats 2>/dev/null | grep -E 'total_connections_received|instantaneous_ops_per_sec|rejected_connections|keyspace' || true
docker logs deploy-evolution-1 --since "${HOURS}h" 2>&1 | grep -iE 'error|attack|rate|flood|blocked|unauthorized' | tail -15 || true
