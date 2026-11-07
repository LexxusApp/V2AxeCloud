import urllib.request
import json

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

req = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages?body=ilike.*organizadora*&limit=1", headers=headers)
with urllib.request.urlopen(req) as resp:
    msgs = json.loads(resp.read().decode())
    if msgs:
        msg = msgs[0]
        c_id = msg.get("conversation_id")
        print("Msg encontrada:", msg.get("created_at"), "Conversation ID:", c_id)
        
        req_c = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{c_id}", headers=headers)
        with urllib.request.urlopen(req_c) as resp_c:
            conv = json.loads(resp_c.read().decode())[0]
            print("Conversa:", json.dumps(conv, indent=2))
            
        req_all = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{c_id}&order=created_at.asc", headers=headers)
        with urllib.request.urlopen(req_all) as resp_all:
            all_m = json.loads(resp_all.read().decode())
            print("\nHistórico da conversa:")
            for m in all_m:
                print(f"  [{m.get('created_at')}] {m.get('direction')}: {m.get('body')}")
