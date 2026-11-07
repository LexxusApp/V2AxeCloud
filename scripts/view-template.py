import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

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

tmpl_name = sys.argv[1] if len(sys.argv) > 1 else "atualizacao_modulo_zelador_axecloud"

req = urllib.request.Request(
    f"https://graph.facebook.com/v21.0/{waba}/message_templates?name={tmpl_name}",
    headers={"Authorization": f"Bearer {token}"}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())

print(json.dumps(data, indent=2, ensure_ascii=False))
