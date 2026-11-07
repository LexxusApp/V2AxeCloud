import json
import urllib.request
import urllib.parse
import sys

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

template_name = sys.argv[1] if len(sys.argv) > 1 else "aviso_geral_axecloud"
url = f"https://graph.facebook.com/v21.0/{waba}/message_templates?name={template_name}"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())
    print(json.dumps(data, indent=2, ensure_ascii=False))
