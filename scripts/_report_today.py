import os
import json
import urllib.request
from datetime import datetime, timezone, timedelta

env = {}
if os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"\'')

url = env.get('VITE_SUPABASE_URL') or env.get('SUPABASE_URL') or 'https://vlaojhfwhqmwudqsumpi.supabase.co'
key = env.get('SUPABASE_SERVICE_ROLE_KEY') or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYW9qaGZ3aHFtd3VkcXN1bXBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTIwNDE2NCwiZXhwIjoyMDkwNzgwMTY0fQ.3BmBPr8C7LegYLaF4F4fWJOUvQblfbEeZKXMmOate9o'

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json'
}

def query(table, params=''):
    req = urllib.request.Request(f'{url}/rest/v1/{table}?{params}', headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        return {'error': str(e)}

# 1. Tenants e Users
tenants = query('tenants', 'select=id,nome,created_at,slug&order=created_at.desc')
users = query('users', 'select=id,tenant_id,role,email,nome,created_at&order=created_at.desc')
children = query('children', 'select=id,tenant_id,nome,created_at')

today_iso = '2026-10-15T00:00:00Z'
today_tenants = [t for t in tenants if t.get('created_at', '') >= today_iso]

# 2. Subscriptions
subs = query('subscriptions', 'select=id,tenant_id,status,expires_at,plan,is_blocked,block_reason')

# 3. Telemetria e Logs das últimas 24h
audit = query('audit_logs', f'select=id,action,entity,created_at,details&created_at=gte.{today_iso}&order=created_at.desc')

# 4. WhatsApp / Mensagens hoje
msgs = query('admin_whatsapp_messages', f'select=id,phone,role,created_at&created_at=gte.{today_iso}&order=created_at.desc')

# 5. Leads hoje
leads_today = query('prospecting_leads', f'select=id,name,phone,city,status,updated_at&updated_at=gte.{today_iso}&order=updated_at.desc')

# 6. Tenant failures não resolvidas
failures = query('tenant_feature_failures', 'select=id,tenant_id,feature,severity,error_message,resolved,created_at&resolved=eq.false&order=created_at.desc')

print('=== DADOS GERAIS DO SISTEMA ===')
print(f'Total de Terreiros (Tenants cadastrados): {len(tenants)}')
print(f'Tenants criados hoje (15/10): {len(today_tenants)}')
for t in today_tenants:
    print(f"  • {t.get('nome')} (slug: {t.get('slug')})")

print(f'\nTotal de Filhos de Santo (children): {len(children)}')
print(f'Total de Usuários cadastrados: {len(users)}')

# Subscriptions status
active_subs = [s for s in subs if s.get('status') == 'active' and not s.get('is_blocked')]
blocked_subs = [s for s in subs if s.get('is_blocked')]
print(f'\nAssinaturas Ativas sem bloqueio: {len(active_subs)}')
print(f'Assinaturas Bloqueadas/Expiradas: {len(blocked_subs)}')

print(f'\n=== ATIVIDADE E AUDITORIA HOJE (15/10) ===')
print(f'Total de eventos de auditoria hoje: {len(audit) if isinstance(audit, list) else 0}')
actions_count = {}
if isinstance(audit, list):
    for a in audit:
        act = a.get('action', 'unknown')
        actions_count[act] = actions_count.get(act, 0) + 1
    for act, cnt in sorted(actions_count.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f'  • {act}: {cnt}')

print(f'\n=== DISPAROS DE WHATSAPP HOJE ===')
print(f'Mensagens registradas hoje: {len(msgs) if isinstance(msgs, list) else 0}')

print(f'\n=== PROSPECÇÃO HOJE ===')
print(f'Leads movimentados hoje: {len(leads_today) if isinstance(leads_today, list) else 0}')
status_leads = {}
if isinstance(leads_today, list):
    for l in leads_today:
        st = l.get('status', 'unknown')
        status_leads[st] = status_leads.get(st, 0) + 1
    for st, cnt in status_leads.items():
        print(f'  • {st}: {cnt}')

print(f'\n=== FALHAS NÃO RESOLVIDAS (tenant_feature_failures) ===')
print(f'Total pendente: {len(failures) if isinstance(failures, list) else 0}')
if isinstance(failures, list):
    for f in failures[:5]:
        print(f"  • Feature: {f.get('feature')} | Severity: {f.get('severity')} | Msg: {f.get('error_message')[:80]}")
