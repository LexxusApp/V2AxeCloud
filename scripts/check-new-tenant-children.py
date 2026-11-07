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

tenant_id = '7c8b83b6-5561-4595-85df-ef290d2e6baa'
url = f"{sb_url}/rest/v1/filhos_de_santo?lider_id=eq.{tenant_id}&select=id,nome,created_at"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    children = json.loads(resp.read().decode())

print(f"Filhos cadastrados pelo novo terreiro ({len(children)}):")
for c in children:
    print(f"  • {c.get('nome')} | Criado em: {c.get('created_at')}")
