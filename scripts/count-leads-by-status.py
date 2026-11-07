import urllib.request
import json
from collections import Counter

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
    'Prefer': 'count=exact'
}

statuses = [
    'discovered', 'enriching', 'analyzed', 'qualified', 'waiting_contact',
    'contacted', 'replied', 'interested', 'demo', 'trial', 'customer',
    'not_interested', 'do_not_contact', 'duplicate', 'invalid'
]

print("=== CONTAGEM EXATA POR STATUS EM prospecting_leads ===")
total = 0
for st in statuses:
    url = f"{sb_url}/rest/v1/prospecting_leads?status=eq.{st}&select=id"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        # Pega content-range header
        cr = resp.headers.get('content-range')
        cnt = int(cr.split('/')[1]) if cr and '/' in cr else 0
        total += cnt
        if cnt > 0:
            print(f"  • {st:16}: {cnt}")

print(f"TOTAL GERAL: {total}")
