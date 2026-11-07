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

p = "84591717"
url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?phone_e164=ilike.*{p}*&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    convs = json.loads(resp.read().decode())

print(f"Conversas para {p}: {len(convs)}")
for c in convs:
    print(c)
    conv_id = c['id']
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{conv_id}&select=*&order=created_at.asc"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    print(f"Total msgs: {len(msgs)}")
    for m in msgs:
        print(f"  [{m.get('direction').upper()}] {m.get('created_at')}: {m.get('body')}")
