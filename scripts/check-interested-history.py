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

leads = [
    ("Ricardo Marcelo Laurindo", "d8194cd4-ed42-4672-a1f3-e00b9c54f45c", "554896133539"),
    ("-BAMBAM-", "46e51dcd-c2a7-480c-95f6-816b372e557b", "554888367666"),
    ("Eduardo tec lights", "507e4cfd-6b47-449e-9d0e-59e6ee0dd5a0", "554884737314"),
]

print("=== HISTÓRICO DE MENSAGENS DOS INTERESSADOS ===")
for name, cid, phone in leads:
    print(f"\n--- {name} ({phone}) [Conv ID: {cid}] ---")
    url = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&select=*&order=created_at.asc"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        msgs = json.loads(resp.read().decode())
        print(f"Total mensagens: {len(msgs)}")
        for m in msgs:
            direc = "INBOUND" if m.get("direction") == "inbound" else "OUTBOUND"
            print(f"  • [{m.get('created_at')}] ({direc}): {m.get('body')}")
