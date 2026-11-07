import json
import urllib.request
import re
import random
import datetime
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
wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

headers_sb = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def query(endpoint):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", headers=headers_sb)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def patch(endpoint, data):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", data=json.dumps(data).encode("utf-8"), headers=headers_sb, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def insert(endpoint, data):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", data=json.dumps(data).encode("utf-8"), headers=headers_sb, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def send_wa(phone, text):
    meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "text",
        "text": {"preview_url": True, "body": text}
    }
    req = urllib.request.Request(
        meta_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        return data.get("messages", [{}])[0].get("id", "unknown")

print("=== VERIFICANDO CONVERSAS RECENTES NO WHATSAPP ADMIN ===")
convs = query("admin_whatsapp_conversations?order=updated_at.desc&limit=6")
for c in convs:
    name = c.get("contact_name")
    phone = c.get("phone_e164")
    cid = c.get("id")
    unread = c.get("unread_count")
    updated = c.get("updated_at")
    last_msg = c.get("last_message_preview")
    print(f"\n• {name} ({phone}) - Unread: {unread} - Atualizado: {updated}")
    print(f"  Última: {last_msg}")

print("=== DETALHANDO CONVERSA DE VALDETY GARCIA POLICARPO ===")
cid = "1f596c45-0853-4058-8772-179ac2f964b8"
msgs = query(f"admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc")
for m in msgs:
    print(f"[{m.get('created_at')}] {m.get('direction')} ({m.get('message_type')}): {m.get('body')}")
    if m.get('message_type') == 'audio' or (m.get('raw_payload') and 'audio' in m.get('raw_payload')):
        print("  Payload audio:", json.dumps(m.get('raw_payload'), ensure_ascii=False))

