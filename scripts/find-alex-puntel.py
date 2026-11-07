import urllib.request
import json

env = dict(l.strip().split('=', 1) for l in open('.env', encoding='utf-8') if '=' in l and not l.strip().startswith('#'))
sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

p = "88635903"
# 1. prospecting_leads
url = f"{sb_url}/rest/v1/prospecting_leads?phone=ilike.*{p}*&select=*"
try:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=headers)).read().decode())
    print("prospecting_leads:", d)
except Exception as e:
    print("prospecting_leads err:", e)

# 2. terreiros_diretorio
url = f"{sb_url}/rest/v1/terreiros_diretorio?telefone=ilike.*{p}*&select=id,nome,cidade,estado,responsavel"
try:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=headers)).read().decode())
    print("terreiros_diretorio:", d)
except Exception as e:
    print("terreiros_diretorio err:", e)

# 3. perfil_lider
url = f"{sb_url}/rest/v1/perfil_lider?whatsapp=ilike.*{p}*&select=*"
try:
    d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=headers)).read().decode())
    print("perfil_lider:", d)
except Exception as e:
    print("perfil_lider err:", e)
