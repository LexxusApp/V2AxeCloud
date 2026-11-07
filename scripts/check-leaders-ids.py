import urllib.request
import json

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

url = f"{sb_url}/rest/v1/perfil_lider?nome_terreiro=ilike.*Nan%C3%A3*&select=id,tenant_id,nome_terreiro,email"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    print("Nanã:", json.loads(resp.read().decode()))

url2 = f"{sb_url}/rest/v1/perfil_lider?nome_terreiro=ilike.*Xang%C3%B4*&select=id,tenant_id,nome_terreiro,email"
req2 = urllib.request.Request(url2, headers=headers)
with urllib.request.urlopen(req2) as resp2:
    print("Xangô:", json.loads(resp2.read().decode()))
