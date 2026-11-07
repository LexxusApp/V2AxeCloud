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

url = env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

for conv_id in ['b28a4ce9-fd84-4abc-a714-ac99d0a96af9', 'cd45199f-9ec4-4f1a-9e4b-038967f6ee4c']:
    req = urllib.request.Request(f'{url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{conv_id}&order=created_at.asc', headers=headers)
    with urllib.request.urlopen(req) as res:
        msgs = json.loads(res.read().decode())
    print(f"\n=== CONVERSA {conv_id} ===")
    for m in msgs:
        print(f"[{m.get('created_at')[:19]}] {m.get('direction').upper()}: {m.get('body')}")
