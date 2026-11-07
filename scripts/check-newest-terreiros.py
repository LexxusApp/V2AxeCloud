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

print("=== VERIFICANDO ÚLTIMOS TERREIROS CADASTRADOS ===")
url = f"{sb_url}/rest/v1/perfil_lider?select=*&order=created_at.desc&limit=5"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    leaders = json.loads(resp.read().decode())

for idx, l in enumerate(leaders, 1):
    print(f"\n{idx}. Nome: {l.get('nome_terreiro')}")
    print(f"   Dirigente: {l.get('nome')} | Cargo: {l.get('cargo')}")
    print(f"   E-mail: {l.get('email')} | Telefone: {l.get('telefone')}")
    print(f"   Criado em: {l.get('created_at')}")
    print(f"   ID: {l.get('id')} | Tenant ID: {l.get('tenant_id')}")
