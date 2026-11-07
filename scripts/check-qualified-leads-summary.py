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

url = f"{sb_url}/rest/v1/prospecting_leads?status=eq.qualified&select=id,name,phone,phone_normalized,city,state"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    leads = json.loads(resp.read().decode())

print(f"Total leads qualificados disponíveis para disparo: {len(leads)}")
by_state = {}
for l in leads:
    st = l.get('state') or 'SEM_ESTADO'
    by_state[st] = by_state.get(st, 0) + 1

for st, count in sorted(by_state.items(), key=lambda x: -x[1]):
    print(f"  {st}: {count} leads")

print("\nPrimeiros 10 leads da fila:")
for l in leads[:10]:
    print(f"  - {l.get('name')} | {l.get('city')}/{l.get('state')} | {l.get('phone_normalized') or l.get('phone')}")
