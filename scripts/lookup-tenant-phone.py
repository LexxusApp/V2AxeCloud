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

url = env.get('VITE_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

tid = '5de04732-9419-4ef5-8558-7287ed140e79'
print(f"=== BUSCANDO DADOS PARA TENANT {tid} ===")

# 1. perfil_lider
req = urllib.request.Request(f'{url}/rest/v1/perfil_lider?id=eq.{tid}', headers=headers)
with urllib.request.urlopen(req) as res:
    p = json.loads(res.read().decode())
    print('perfil_lider:', p)

# 2. auth user
req2 = urllib.request.Request(f'{url}/auth/v1/admin/users/{tid}', headers=headers)
try:
    with urllib.request.urlopen(req2) as res:
        u = json.loads(res.read().decode())
        print('auth user email:', u.get('email'))
        print('auth user phone:', u.get('phone'))
        print('auth user metadata:', u.get('user_metadata'))
except Exception as e:
    print('auth error:', e)

# 3. whatsapp_logs
req3 = urllib.request.Request(f'{url}/rest/v1/whatsapp_logs?tenant_id=eq.{tid}&limit=5', headers=headers)
with urllib.request.urlopen(req3) as res:
    print('whatsapp_logs:', json.loads(res.read().decode()))

# 4. lead no CRM / prospecção
email = u.get('email') if 'u' in locals() and u else None
if email:
    req4 = urllib.request.Request(f'{url}/rest/v1/prospecting_leads?email=eq.{email}', headers=headers)
    with urllib.request.urlopen(req4) as res:
        print('lead by email:', json.loads(res.read().decode()))
