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

url = f"{sb_url}/rest/v1/admin_whatsapp_messages?created_at=gte.2026-10-20T12:00:00Z&select=*&order=created_at.asc"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    msgs = json.loads(resp.read().decode())

print(f"Mensagens a partir das 12:00 de hoje: {len(msgs)}")
for m in msgs:
    conv_id = m.get('conversation_id')
    req_c = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}&select=contact_name,phone_e164", headers=headers)
    with urllib.request.urlopen(req_c) as r_c:
        c = json.loads(r_c.read().decode())
        name = c[0].get('contact_name') if c else 'Unknown'
        phone = c[0].get('phone_e164') if c else ''
    print(f"[{m.get('created_at')}] {name} ({phone}) [{m.get('direction').upper()}]:")
    print(f"   {m.get('body')}\n")
