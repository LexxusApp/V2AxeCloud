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

cids = ['11b6b0b6-138e-401e-a9e4-bb918b9053e3', '1cbe96b8-c5f1-4d4e-b561-2bc7ccd52746']
for cid in cids:
    url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{cid}&select=*"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        rows = json.loads(resp.read().decode())
        for r in rows:
            print(f"ID: {r.get('id')} | Name: {r.get('contact_name')} | Phone: {r.get('phone_e164')} | Last: {r.get('last_message_preview')}")
