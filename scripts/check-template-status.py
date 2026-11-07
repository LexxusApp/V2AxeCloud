import json
import urllib.request
import urllib.parse
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
token = env.get("WA_META_TOKEN")
waba = env.get("WA_BUSINESS_ACCOUNT_ID")

templates = ["aviso_estabilidade_axecloud", "acesso_restabelecido_axecloud", "cortesia_30dias_axecloud"]
for name in templates:
    qs = urllib.parse.urlencode({"name": name, "fields": "name,status,category,id,rejected_reason"})
    url = f"https://graph.facebook.com/v21.0/{waba}/message_templates?{qs}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
            for item in data.get("data", []):
                print(f"• {item.get('name')}: {item.get('status')} ({item.get('category')}) | ID: {item.get('id')} | Reject: {item.get('rejected_reason')}")
    except Exception as e:
        print(f"• {name} erro:", e)
