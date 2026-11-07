#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

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
phone_id = env.get("WA_PHONE_NUMBER_ID")
TEMPLATE_NAME = "galeria_memoria_100gb_axecloud"
MEDIA_ID = "2455329178291729"

# Test recipient: Lucas
RECIPIENT = "5511920033501"

payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": RECIPIENT,
    "type": "template",
    "template": {
        "name": TEMPLATE_NAME,
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "header",
                "parameters": [
                    {
                        "type": "image",
                        "image": {
                            "id": MEDIA_ID
                        }
                    }
                ]
            },
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Lucas Siqueira"},
                    {"type": "text", "text": "Terreiro Teste AxéCloud"}
                ]
            }
        ]
    }
}

req = urllib.request.Request(
    f"https://graph.facebook.com/v21.0/{phone_id}/messages",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print("SUCESSO:", json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    print(f"ERRO ({e.code}):", e.read().decode("utf-8"))
