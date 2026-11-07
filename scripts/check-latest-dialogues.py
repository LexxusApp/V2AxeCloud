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

print("=== CONVERSAS QUE CHEGARAM HOJE ===")
url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?order=last_message_at.desc&limit=8"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    convs = json.loads(resp.read().decode())

for c in convs:
    cid = c['id']
    contact = c.get('contact_name') or c.get('phone')
    last_msg = c.get('last_message_at')
    print(f"\n--- {contact} ({c.get('phone')}) | Última em: {last_msg} ---")
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc&limit=10"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    for m in msgs:
        d = "INBOUND ⬅️" if m.get("direction") == "inbound" else "OUTBOUND ➡️"
        body = m.get("body") or m.get("message_text") or ""
        print(f"  [{m.get('created_at')[:19]}] {d}: {body[:140]}")
