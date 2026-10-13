import urllib.request
import json
import os
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env(path=".env"):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env()
url = env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

req = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_messages?select=*&order=created_at.desc&limit=25", headers=headers)
with urllib.request.urlopen(req) as resp:
    msgs = json.loads(resp.read().decode())
    print("=== ÚLTIMAS MENSAGENS NO CHAT DO WHATSAPP ADMIN ===")
    for m in msgs:
        direction = m.get('direction') or ('in' if m.get('from_me') is False else 'out')
        sender = m.get('sender_name') or m.get('sender_phone') or m.get('contact_name') or m.get('conversation_id')
        content = m.get('text') or m.get('body') or m.get('content') or m.get('message')
        print(f"[{m.get('created_at')}] ({direction}) {sender}: {content}")
