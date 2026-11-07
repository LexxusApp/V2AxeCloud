import json
import urllib.request
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
headers_sb = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}', 'Content-Type': 'application/json'}

cid = 'af646dd9-bb57-4798-ba17-8ff59a6c7aee'
patch = {
    "unread_count": 0,
    "last_message_preview": "Olá, Beatriz! Você pode acessar o Portal do Filho de Santo..."
}
req = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{cid}", data=json.dumps(patch).encode(), headers=headers_sb, method="PATCH")
with urllib.request.urlopen(req) as resp:
    print("Conversa lida e atualizada.")
