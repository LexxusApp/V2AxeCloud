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

print("=== NOVO TERREIRO CADASTRADO: ORDEM FLORESTA MÍSTICA ===")
url = f"{sb_url}/rest/v1/perfil_lider?email=eq.fabioalex_rj@hotmail.com&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    profiles = json.loads(resp.read().decode())

for p in profiles:
    print(f"ID: {p.get('id')}")
    print(f"Nome Terreiro: {p.get('nome_terreiro')}")
    print(f"Email: {p.get('email')}")
    print(f"Cargo: {p.get('cargo')}")
    print(f"Telefone: {p.get('telefone')}")
    print(f"Criado em: {p.get('created_at')}")

    tid = p.get('tenant_id') or p.get('id')
    # Verifica assinatura
    url_s = f"{sb_url}/rest/v1/assinaturas?perfil_lider_id=eq.{p.get('id')}&select=*"
    try:
        req_s = urllib.request.Request(url_s, headers=headers)
        with urllib.request.urlopen(req_s) as resp_s:
            subs = json.loads(resp_s.read().decode())
            print(f"Assinatura: {subs}")
    except Exception as e:
        print(f"Assinatura err: {e}")
