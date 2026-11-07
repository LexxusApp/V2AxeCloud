import json
import urllib.request
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env():
    env = {}
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('\'"')
    return env

env = load_env()
url = env.get('VITE_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

print("=== 1. CONVERSA DA CASA ESPIRITUALISTA MARIA PADILHA ===")
conv_id = "50684e54-00f8-4fe8-a36e-97db9249b7b4"
req_m = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{conv_id}&order=created_at.asc", headers=headers)
with urllib.request.urlopen(req_m) as res:
    msgs = json.loads(res.read().decode())
for m in msgs:
    d = "⬅️ INBOUND " if m.get("direction") == "inbound" else "➡️ OUTBOUND"
    print(f"[{m.get('created_at')[:19]}] {d}: {m.get('body')}")

print("\n=== 2. COMO OS 3 LEADS CONVERTERAM PARA TRIAL? ===")
req_t = urllib.request.Request(f"{url}/rest/v1/prospecting_leads?status=eq.trial&select=id,name,phone,email,created_at", headers=headers)
with urllib.request.urlopen(req_t) as res:
    trials = json.loads(res.read().decode())

for t in trials:
    phone = t['phone'].replace('+', '').replace('-', '').replace(' ', '')
    print(f"\n--- TRIAL: {t['name']} ({t['phone']}) - Email: {t['email']} ---")
    search_digits = phone[-8:]
    req_c = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_conversations?phone_e164=like.*{search_digits}*&select=id,contact_name", headers=headers)
    with urllib.request.urlopen(req_c) as resc:
        cc = json.loads(resc.read().decode())
    if cc:
        cid = cc[0]['id']
        req_msgs = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc", headers=headers)
        with urllib.request.urlopen(req_msgs) as resm:
            mm = json.loads(resm.read().decode())
        for m in mm:
            d = "⬅️ INBOUND " if m.get("direction") == "inbound" else "➡️ OUTBOUND"
            print(f"  [{m.get('created_at')[:19]}] {d}: {m.get('body')}")
