import urllib.request
import json
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
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

print("=== VERIFICANDO DISPAROS DE GIRA HOJE ===")
url = f"{sb_url}/rest/v1/whatsapp_deliveries?created_at=gte.2026-10-16T12:00:00Z&source=eq.calendar&order=created_at.desc&limit=30"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    deliveries = json.loads(resp.read().decode())

print(f"Total de disparos de gira encontrados hoje: {len(deliveries)}")
for d in deliveries:
    print(f"• Para: {d.get('recipient_name')} ({d.get('phone')}) | Template: {d.get('template_name')} | Status: {d.get('status')} | Em: {d.get('created_at')}")

# Verifica também em whatsapp_logs se houver
url_l = f"{sb_url}/rest/v1/whatsapp_logs?created_at=gte.2026-10-16T12:00:00Z&tipo=ilike.*gira*&order=created_at.desc&limit=30"
try:
    req_l = urllib.request.Request(url_l, headers=headers)
    with urllib.request.urlopen(req_l) as resp_l:
        logs = json.loads(resp_l.read().decode())
    print(f"\nTotal em whatsapp_logs: {len(logs)}")
    for l in logs:
        print(f"  Log: {l.get('telefone')} | Status: {l.get('status')} | Mensagem: {str(l.get('mensagem'))[:60]}")
except Exception as e:
    print("Logs err:", e)
