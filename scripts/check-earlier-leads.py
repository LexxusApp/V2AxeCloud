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
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

convs = [
    ("Matheus", "2084ed04-49d3-4315-a89b-6aa56f3ae6cf"),
    ("Ronaldo Leal da Veiga", "0dc88e4c-5edb-4619-bbd5-966fe9ac5633"),
    ("Vitória Bitten", "cd069297-fa13-4cf1-85c0-e545ea91f632"),
]

for name, cid in convs:
    print(f"\n--- {name} ---")
    url = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&select=*&order=created_at.asc"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        msgs = json.loads(resp.read().decode())
        print(f"Total msgs: {len(msgs)}")
        for m in msgs:
            direc = "INBOUND" if m.get("direction") == "inbound" else "OUTBOUND"
            print(f"  • [{m.get('created_at')}] ({direc}): {m.get('body')}")
