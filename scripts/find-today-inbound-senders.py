import json
import urllib.request
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
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

# 1. Buscar quem reclamou de login hoje
req_m = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_messages?created_at=gte.2026-10-13T00:00:00Z&direction=eq.inbound&order=created_at.desc",
    headers=headers
)
with urllib.request.urlopen(req_m) as res:
    msgs = json.loads(res.read().decode())

print("=== MENSAGENS INBOUND DE HOJE ===")
for m in msgs:
    cid = m.get("conversation_id")
    # Buscar detalhes da conversa
    req_c = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_conversations?id=eq.{cid}", headers=headers)
    with urllib.request.urlopen(req_c) as resc:
        conv = json.loads(resc.read().decode())
    c_info = conv[0] if conv else {}
    print(f"[{m.get('created_at')[:19]}] Contato: {c_info.get('contact_name')} ({c_info.get('phone_e164')}):")
    print(f"   Mensagem: {m.get('body')}")
