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

print("=== DETALHES DE SANDRA ===")
url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?contact_name=ilike.*Sandra*&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    convs = json.loads(resp.read().decode())

for c in convs:
    phone = c.get('phone_e164')
    cid = c['id']
    print(f"Conversa: {c.get('contact_name')} | Tel: {phone} | ID: {cid} | Não lidas: {c.get('unread_count')}")

    # Lead
    url_l = f"{sb_url}/rest/v1/prospecting_leads?phone=ilike.*{phone[-8:]}*&select=*"
    req_l = urllib.request.Request(url_l, headers=headers)
    with urllib.request.urlopen(req_l) as resp_l:
        leads = json.loads(resp_l.read().decode())
    for l in leads:
        print(f"  Lead: {l.get('name')} | Cidade: {l.get('city')}-{l.get('state')} | Status: {l.get('status')} | ID: {l.get('id')}")

    # Mensagens
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    print(f"  Total mensagens ({len(msgs)}):")
    for m in msgs:
        d = "INBOUND ⬅️" if m.get("direction") == "inbound" else "OUTBOUND ➡️"
        print(f"    [{m.get('created_at')[:19]}] {d}: {m.get('body')}")
