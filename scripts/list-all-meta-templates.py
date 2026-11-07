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

token = env.get("WA_META_TOKEN")
waba = env.get("WA_BUSINESS_ACCOUNT_ID")

url = f"https://graph.facebook.com/v21.0/{waba}/message_templates?limit=100"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())

print("=== TEMPLATES APROVADOS NA META ===")
for t in data.get("data", []):
    if t.get("status") == "APPROVED":
        print(f"• {t['name']} [{t['category']}]")
        for c in t.get("components", []):
            if c.get("type") == "BODY":
                print(f"   Corpo: {c.get('text')}")
            if c.get("type") == "BUTTONS":
                for b in c.get("buttons", []):
                    print(f"   Botão: [{b.get('text')}] -> {b.get('url') or b.get('type')}")
        print()
