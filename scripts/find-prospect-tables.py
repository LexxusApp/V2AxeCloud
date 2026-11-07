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
            k, v = line.strip().split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL']
sb_key = env['SUPABASE_SERVICE_ROLE_KEY']
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

req = urllib.request.Request(f'{sb_url}/rest/v1/?apikey={sb_key}', headers=headers)
with urllib.request.urlopen(req) as resp:
    spec = json.loads(resp.read().decode())
    definitions = spec.get('definitions', {})
    print("Total definitions:", len(definitions))
    for t in sorted(definitions.keys()):
        if any(w in t.lower() for w in ['prospect', 'lead', 'terreiro', 'diretorio', 'growth', 'outreach', 'campanha']):
            print(f"  • {t}")
