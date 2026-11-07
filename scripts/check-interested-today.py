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

target_cids = ["a6903fb6-e5da-484a-898c-dfa11fe88f03", "7fd97595-6aa7-4513-8bf0-1b0a10cf9763"]

print("=== DIÁLOGOS DOS LEADS QUE CLICARAM 'QUERO CONHECER' HOJE ===")
for cid in target_cids:
    url_c = f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{cid}&select=*"
    req_c = urllib.request.Request(url_c, headers=headers)
    with urllib.request.urlopen(req_c) as resp:
        convs = json.loads(resp.read().decode())
    c = convs[0] if convs else {}
    print(f"\n--- {c.get('contact_name')} ({c.get('phone_e164')}) | Não lidas: {c.get('unread_count')} ---")

    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    for m in msgs:
        d = "INBOUND ⬅️" if m.get("direction") == "inbound" else "OUTBOUND ➡️"
        print(f"  [{m.get('created_at')[:19]}] {d}: {m.get('body')}")
