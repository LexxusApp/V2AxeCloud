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

waiting = [
    ("Cristina De Oya", "554788009330"),
    ("Yle ase", "554797394827"),
    ("Casa Grande", "554791476015"),
    ("Mãe Tânia d Oxum", "554791969424"),
    ("Sandra", "554888745143"),
]

print("=== VERIFICANDO CONVERSAS PENDENTES DE RESPOSTA ===")
for name, phone in waiting:
    url_c = f"{sb_url}/rest/v1/admin_whatsapp_conversations?phone_e164=eq.{phone}&select=*"
    req_c = urllib.request.Request(url_c, headers=headers)
    with urllib.request.urlopen(req_c) as resp_c:
        convs = json.loads(resp_c.read().decode())
    if not convs:
        continue
    c = convs[0]
    cid = c['id']
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    print(f"\n--- {name} ({phone}) [Conv: {cid}] ---")
    for m in msgs:
        d = "INBOUND ⬅️" if m.get('direction') == 'inbound' else "OUTBOUND ➡️"
        print(f"  [{m.get('created_at')[:19]}] {d}: {m.get('body')}")
