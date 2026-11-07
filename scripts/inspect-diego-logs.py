import urllib.request
import json
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

sb_url = env["VITE_SUPABASE_URL"].strip()
sb_key = env["SUPABASE_SERVICE_ROLE_KEY"].strip()
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

url = f"{sb_url}/rest/v1/whatsapp_logs?telefone=ilike.*2606*&order=created_at.desc&limit=10"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    logs = json.loads(resp.read().decode())
    print("=== LOGS DE WHATSAPP PARA DIEGO (2606) ===")
    for l in logs:
        print(f"ID: {l.get('id')}")
        print(f"Created: {l.get('created_at')}")
        print(f"Tipo: {l.get('tipo')}")
        print(f"Telefone: {l.get('telefone')}")
        print(f"Status: {l.get('status')}")
        print(f"External ID: {l.get('external_id')}")
        print(f"Mensagem: {l.get('mensagem')}")
        print(f"Error: {l.get('error') or l.get('error_message')}")
        print("-" * 50)
