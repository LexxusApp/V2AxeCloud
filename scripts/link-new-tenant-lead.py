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

print("=== VERIFICANDO O NOVO CADASTRO: YLE ASE TOBI OMIM YNA ===")
url_p = f"{sb_url}/rest/v1/prospecting_leads?phone=ilike.*97394827*&select=*"
req_p = urllib.request.Request(url_p, headers=headers)
with urllib.request.urlopen(req_p) as resp_p:
    leads = json.loads(resp_p.read().decode())

for l in leads:
    print(f"Lead no CRM: {l.get('name')} | Cidade: {l.get('city')}-{l.get('state')} | Tel: {l.get('phone')} | ID: {l.get('id')}")

# Atualiza lead para trial e vincula o terreiro
if leads:
    lid = leads[0]['id']
    tenant_id = '7c8b83b6-5561-4595-85df-ef290d2e6baa'
    patch = {
        'status': 'trial',
        'email': 'margalu489@gmail.com',
        'terreiro_id': tenant_id
    }
    url_u = f"{sb_url}/rest/v1/prospecting_leads?id=eq.{lid}"
    req_u = urllib.request.Request(url_u, data=json.dumps(patch).encode('utf-8'), headers={**headers, 'Content-Type': 'application/json'}, method='PATCH')
    with urllib.request.urlopen(req_u) as resp_u:
        print("Lead atualizado para status TRIAL no CRM com sucesso!")
