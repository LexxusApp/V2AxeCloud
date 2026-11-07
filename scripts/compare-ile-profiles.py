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

import urllib.parse
print("=== COMPARANDO OS DOIS PERFIS DE ILÉ ÀṢẸ ONA OMI Ọ̀ṢUN ===")
url = f"{sb_url}/rest/v1/terreiros_diretorio?nome=ilike.*Ona%20Omi*&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    rows = json.loads(resp.read().decode())

for r in rows:
    print(f"\nID: {r.get('id')}")
    print(f"Nome: {r.get('nome')}")
    print(f"Endereço: {r.get('endereco')} - {r.get('cidade')}/{r.get('estado')}")
    print(f"Telefone: {r.get('telefone')}")
    print(f"Claimed by: {r.get('claimed_by_tenant_id')}")
    print(f"Slug: {r.get('slug')}")
    print(f"Criado em: {r.get('created_at')}")
