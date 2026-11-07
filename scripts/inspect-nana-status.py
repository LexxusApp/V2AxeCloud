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

tid = 'b47b3014-5ff5-4ffb-aba5-78a4f2aa253a'

# 1. Perfil Líder
url_l = f"{sb_url}/rest/v1/perfil_lider?id=eq.{tid}&select=*"
req_l = urllib.request.Request(url_l, headers=headers)
with urllib.request.urlopen(req_l) as resp_l:
    lider = json.loads(resp_l.read().decode())
print("👑 Líder:", lider)

# 2. Diretório
url_d = f"{sb_url}/rest/v1/terreiros_diretorio?claimed_by_tenant_id=eq.{tid}&select=id,nome,cidade,estado,slug,publicacao_status,claimed_by_tenant_id"
req_d = urllib.request.Request(url_d, headers=headers)
with urllib.request.urlopen(req_d) as resp_d:
    dir_rows = json.loads(resp_d.read().decode())
print("📍 Diretório no Mapa:", dir_rows)

# 3. Lead na prospecção
url_p = f"{sb_url}/rest/v1/prospecting_leads?phone=ilike.*999498604*&select=*"
req_p = urllib.request.Request(url_p, headers=headers)
with urllib.request.urlopen(req_p) as resp_p:
    leads = json.loads(resp_p.read().decode())
print("🎯 Lead Prospecting:", leads)

# 4. Assinatura
url_s = f"{sb_url}/rest/v1/subscriptions?id=eq.{tid}&select=*"
req_s = urllib.request.Request(url_s, headers=headers)
with urllib.request.urlopen(req_s) as resp_s:
    subs = json.loads(resp_s.read().decode())
print("💳 Assinatura:", subs)
