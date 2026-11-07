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

conv_ids = [
    ('cd069297-fa13-4cf1-85c0-e545ea91f632', 'Vitoria Bitten (554896857910)'),
    ('2b7eaf9b-cbbf-4257-b580-544ee8c2df58', 'Macaia de Tranca-Ruas (554999007751)'),
    ('0dc88e4c-5edb-4619-bbd5-966fe9ac5633', 'Ronaldo Leal da Veiga (554891474288)'),
    ('2084ed04-49d3-4315-a89b-6aa56f3ae6cf', 'Matheus (556294580419)')
]

for cid, name in conv_ids:
    print('='*70)
    print(f"CONVERSA: {name} (ID: {cid})")
    req = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc", headers=headers)
    with urllib.request.urlopen(req) as res:
        msgs = json.loads(res.read().decode())
    for m in msgs:
        d = "⬅️ INBOUND " if m.get("direction") == "inbound" else "➡️ OUTBOUND"
        print(f"  [{str(m.get('created_at'))[:19]}] {d}: {m.get('body')}")

# Also check prospecting_leads status for these numbers
print("\n" + "="*70)
print("STATUS EM PROSPECTING_LEADS:")
for _, name in conv_ids:
    digits = name.split('(')[1].split(')')[0]
    req_l = urllib.request.Request(f"{url}/rest/v1/prospecting_leads?phone=like.*{digits[-8:]}*&select=id,name,phone,status,score,last_contact_at", headers=headers)
    with urllib.request.urlopen(req_l) as res:
        ll = json.loads(res.read().decode())
    for l in ll:
        print(f"• {l.get('name')} | Status: {l.get('status')} | Score: {l.get('score')} | Tel: {l.get('phone')}")
