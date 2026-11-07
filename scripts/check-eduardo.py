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

cid = '507e4cfd-6b47-449e-9d0e-59e6ee0dd5a0'
url = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    msgs = json.loads(resp.read().decode())
    print("=== MENSAGENS DO EDUARDO TEC LIGHTS ===")
    for m in msgs:
        print(f"[{m.get('created_at')}] ({m.get('direction')}): {m.get('body')}")
