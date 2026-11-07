import urllib.request
import json
import datetime
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

def get(path):
    req = urllib.request.Request(f"{sb_url}/rest/v1/{path}", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {'error': str(e)}

today = '2026-10-20'
print(f"==================================================")
print(f"RELATÓRIO CONSOLIDADO DO DIA: {today}")
print(f"==================================================\n")

# 1. Novos líderes / terreiros cadastrados hoje
lideres = get(f"perfil_lider?created_at=gte.{today}T00:00:00Z&select=*")
print(f"1. Novos Terreiros Cadastrados Hoje: {len(lideres)}")
for l in lideres:
    print(f"   • {l.get('nome_terreiro')} ({l.get('cargo')})")
    print(f"     Email: {l.get('email')} | WA: {l.get('whatsapp')} | Hora: {l.get('created_at')}")

# 2. Filhos de Santo adicionados hoje
filhos = get(f"filhos_de_santo?created_at=gte.{today}T00:00:00Z&select=id,nome,tenant_id,created_at")
print(f"\n2. Filhos de Santo Cadastrados Hoje: {len(filhos)}")
for fi in filhos:
    print(f"   • {fi.get('nome')} | Tenant: {fi.get('tenant_id')} ({fi.get('created_at')})")

# 3. Mensagens do WhatsApp CRM hoje
msgs = get(f"admin_whatsapp_messages?created_at=gte.{today}T00:00:00Z&select=id,direction,status,body,created_at,message_type&order=created_at.desc")
inbounds = [m for m in msgs if m.get('direction') == 'inbound']
outbounds = [m for m in msgs if m.get('direction') == 'outbound']
print(f"\n3. WhatsApp CRM & Prospecção:")
print(f"   • Total de mensagens trocadas: {len(msgs)}")
print(f"   • Inbound (recebidas de leads): {len(inbounds)}")
print(f"   • Outbound (enviadas para leads): {len(outbounds)}")
print(f"\n   Últimas mensagens inbound recebidas:")
for m in inbounds[:8]:
    print(f"     [{m.get('created_at')[11:19]}] {m.get('body', '').replace(chr(10), ' ')[:100]}")

# 4. Disparos dos Terreiros hoje (whatsapp_logs)
logs = get(f"whatsapp_logs?created_at=gte.{today}T00:00:00Z&select=id,telefone,tipo,status,created_at,mensagem,tenant_id&order=created_at.desc")
print(f"\n4. Disparos Emitidos pelos Terreiros (whatsapp_logs): {len(logs)}")
by_tipo = {}
for l in logs:
    t = l.get('tipo', 'outro')
    by_tipo[t] = by_tipo.get(t, 0) + 1
for t, c in by_tipo.items():
    print(f"   • {t}: {c}")

# 5. Falhas & Telemetria hoje
failures = get(f"tenant_feature_failures?created_at=gte.{today}T00:00:00Z&select=*")
print(f"\n5. Falhas Registradas no Monitoramento Hoje: {len(failures)}")
for f in failures:
    print(f"   • Feature: {f.get('feature')} | Resolvido: {f.get('resolved')} | Erro: {f.get('error_message')}")

# 6. Eventos de prospecção hoje
events = get(f"prospecting_events?created_at=gte.{today}T00:00:00Z&select=*&order=created_at.desc")
print(f"\n6. Eventos de Funil / Prospecção: {len(events)}")
by_ev = {}
for e in events:
    t = e.get('event_type')
    by_ev[t] = by_ev.get(t, 0) + 1
for ev, c in by_ev.items():
    print(f"   • {ev}: {c}")

