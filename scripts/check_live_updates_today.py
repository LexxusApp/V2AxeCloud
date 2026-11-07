import urllib.request
import json
from datetime import datetime

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
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

print("=== VERIFICANDO ATUALIZAÇÕES E NOVIDADES DE HOJE ===")

# 1. Pai Cristian (Urandi) status
try:
    req_sub = urllib.request.Request(f"{sb_url}/rest/v1/subscriptions?id=eq.3b0bac5d-93fd-4612-a0ef-00f41104593b", headers=headers)
    with urllib.request.urlopen(req_sub) as resp:
        sub = json.loads(resp.read().decode())
        if sub:
            print(f"1. Assinatura Pai Cristian: {sub[0].get('status')} (TxID: {sub[0].get('efi_pix_txid')})")
except Exception as e:
    print("Erro sub:", e)

# 2. Respostas no WhatsApp hoje via admin_whatsapp_messages
try:
    req_conv = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_conversations?order=last_message_at.desc&limit=6", headers=headers)
    with urllib.request.urlopen(req_conv) as resp:
        convs = json.loads(resp.read().decode())
        print(f"\n2. Conversas recentes no CRM ({len(convs)}):")
        for c in convs:
            print(f"   - {c.get('contact_name')} ({c.get('phone_e164')}): Última msg às {c.get('last_message_at')}")

    req_msg = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages?order=created_at.desc&limit=6", headers=headers)
    with urllib.request.urlopen(req_msg) as resp:
        msgs = json.loads(resp.read().decode())
        print(f"\n   Últimas mensagens trocadas:")
        for m in msgs:
            print(f"   [{m.get('created_at')}] {m.get('direction')} ({m.get('type')}): {str(m.get('body') or '')[:75]}")
except Exception as e:
    print("Erro msg:", e)

# 3. Logins recentes
try:
    req_users = urllib.request.Request(f"{sb_url}/auth/v1/admin/users?per_page=50", headers=headers)
    with urllib.request.urlopen(req_users) as resp:
        users = json.loads(resp.read().decode()).get("users", [])
        today_logins = [u for u in users if (u.get("last_sign_in_at") or "") >= "2026-10-22T00:00:00Z"]
        print(f"\n3. Logins efetuados hoje ({len(today_logins)}):")
        for u in today_logins:
            print(f"   - {u.get('email')} às {u.get('last_sign_in_at')}")
except Exception as e:
    print("Erro users:", e)

# 4. Fotos subidas na galeria recentemente
try:
    req_photos = urllib.request.Request(f"{sb_url}/rest/v1/galeria_fotos?order=created_at.desc&limit=5", headers=headers)
    with urllib.request.urlopen(req_photos) as resp:
        photos = json.loads(resp.read().decode())
        print(f"\n4. Fotos recentes na galeria ({len(photos)}):")
        for p in photos:
            print(f"   [{p.get('created_at')}] Terreiro/Tenant: {p.get('tenant_id')}")
except Exception as e:
    print("Galeria fotos:", e)
