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

url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?phone_e164=ilike.*88635903*&select=*"
req = urllib.request.Request(url, headers=headers)
conv = json.loads(urllib.request.urlopen(req).read().decode())
print('Conv:', conv)
if conv:
    c_id = conv[0]['id']
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{c_id}&select=*&order=created_at.asc"
    msgs = json.loads(urllib.request.urlopen(urllib.request.Request(url_m, headers=headers)).read().decode())
    print(f"Total msgs: {len(msgs)}")
    for m in msgs:
        print(f"[{m.get('created_at')}] {m.get('direction').upper()}: {m.get('body')}")
        if m.get('raw_payload'):
            print(f"   Payload: {json.dumps(m.get('raw_payload'))[:200]}")
