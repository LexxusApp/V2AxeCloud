import json
import urllib.request
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

url = env.get('VITE_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

tenant_kwe = 'a90db681-e55f-4668-8715-34e23ffbb591'

# 1. Logs do tenant Kwe
req1 = urllib.request.Request(
    f'{url}/rest/v1/whatsapp_logs?tenant_id=eq.{tenant_kwe}&order=created_at.desc&limit=10',
    headers=headers
)
with urllib.request.urlopen(req1) as res:
    kwe_logs = json.loads(res.read().decode())

print(f"=== TODOS OS LOGS DO TENANT KWE (Total recentes: {len(kwe_logs)}) ===")
for l in kwe_logs:
    print(f"ID: {l.get('id')}")
    print(f"Data: {l.get('created_at')}")
    print(f"Tipo: {l.get('tipo')}")
    print(f"Telefone: {l.get('telefone')}")
    print(f"Status: {l.get('status')}")
    print(f"Mensagem: {l.get('mensagem')}")
    print("-" * 50)

# 2. Logs onde a mensagem menciona 'Kwe' ou 'Odolá' hoje ou ontem
req2 = urllib.request.Request(
    f'{url}/rest/v1/whatsapp_logs?or=(mensagem.ilike.*kwe*,mensagem.ilike.*odol*)&order=created_at.desc&limit=10',
    headers=headers
)
with urllib.request.urlopen(req2) as res:
    msg_logs = json.loads(res.read().decode())

print(f"\n=== LOGS MENCIONANDO 'KWE' OU 'ODOLÁ' (Total recentes: {len(msg_logs)}) ===")
for l in msg_logs:
    print(f"[{l.get('created_at')}] Tipo: {l.get('tipo')} | Tel: {l.get('telefone')} | Msg:\n{l.get('mensagem')}\n")
