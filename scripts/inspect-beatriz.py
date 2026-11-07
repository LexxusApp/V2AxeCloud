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

print("=== CONVERSA BEATRIZ ===")
url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?phone_e164=ilike.*84965477*&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    convs = json.loads(resp.read().decode())

for c in convs:
    cid = c['id']
    print("Conversa:", c)
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    for m in msgs:
        print(f"[{m.get('created_at')}] {m.get('direction')}: {m.get('body')}")
