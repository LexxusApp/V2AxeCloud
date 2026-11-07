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

phones = ["96133539", "88367666", "84737314", "99007751", "96857910", "91474288"]

print("=== CHECKING PROSPECTING_LEADS & CONTACTS ===")
for p in phones:
    url = f"{sb_url}/rest/v1/prospecting_leads?or=(phone.ilike.*{p}*,whatsapp.ilike.*{p}*)&select=id,name,phone,whatsapp,status,stage,score,notes"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"\nPhone fragment {p} in prospecting_leads: {len(data)}")
            for r in data:
                print(f"  • ID: {r.get('id')} | Nome: {r.get('name')} | Status: {r.get('status')} | Stage: {r.get('stage')} | Score: {r.get('score')}")
    except Exception as e:
        print(f"Error {p}: {e}")

print("\n=== CHECKING PROSPECTING_MESSAGES / CONVERSATIONS ===")
url_conv = f"{sb_url}/rest/v1/prospecting_conversations?select=*&order=updated_at.desc&limit=8"
req = urllib.request.Request(url_conv, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"prospecting_conversations recentes: {len(data)}")
        for r in data:
            print(f"  • Lead: {r.get('lead_id')} | Status: {r.get('status')} | State: {r.get('state')} | Updated: {r.get('updated_at')}")
except Exception as e:
    print(f"Error convs: {e}")
