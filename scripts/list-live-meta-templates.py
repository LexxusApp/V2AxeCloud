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
token = env.get("WA_META_TOKEN")
waba = env.get("WA_BUSINESS_ACCOUNT_ID")

req = urllib.request.Request(f"https://graph.facebook.com/v21.0/{waba}/message_templates?limit=100", headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())

print("=== TEMPLATES REGISTRADOS NO META WHATSAPP ===")
for t in data.get("data", []):
    print(f"• {t.get('name')} | Status: {t.get('status')} | Cat: {t.get('category')}")
