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

for name in ["cobranca_cantina_axecloud", "cobranca_lojinha_axecloud"]:
    url = f"https://graph.facebook.com/v21.0/{waba}/message_templates?name={name}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            items = data.get("data", [])
            if items:
                t = items[0]
                print(f"Template '{name}': ID={t.get('id')}, Status={t.get('status')}, Categoria={t.get('category')}")
            else:
                print(f"Template '{name}' não retornado na busca por nome.")
    except Exception as e:
        print(f"Erro ao consultar '{name}':", e)
