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

sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
url = 'https://admin.axecloud.com.br/api/prospecting/dashboard'
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {sb_key}', 'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print('DASHBOARD RESPONSE:')
        print('counts:', json.dumps(data.get('counts'), indent=2))
        print('funnel:', json.dumps(data.get('funnel'), indent=2))
except Exception as e:
    print('Erro:', e)
