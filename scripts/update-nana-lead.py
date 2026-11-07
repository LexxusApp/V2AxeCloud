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
headers = {
    'apikey': sb_key,
    'Authorization': f'Bearer {sb_key}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

lead_id = '9f4df822-6cb6-4c5a-bb75-9b35550240b5'
tid = 'b47b3014-5ff5-4ffb-aba5-78a4f2aa253a'
data = {
    'status': 'trial',
    'email': 'pedromusafa55@gmail.com',
    'terreiro_id': tid
}

url = f"{sb_url}/rest/v1/prospecting_leads?id=eq.{lead_id}"
req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method='PATCH')
with urllib.request.urlopen(req) as resp:
    print("Lead atualizado para trial:", json.loads(resp.read().decode()))
