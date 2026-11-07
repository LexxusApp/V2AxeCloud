import json
import urllib.request
import urllib.error

def load_env(path):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env("AxecloudV2/.env")
token = env["WA_META_TOKEN"]
phone_id = env["WA_PHONE_NUMBER_ID"]
to_phone = "5511920033501"

payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to_phone,
    "type": "template",
    "template": {
        "name": "axecloud_prospeccao_imagem_v1",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "header",
                "parameters": [
                    {
                        "type": "image",
                        "image": {
                            "link": "https://axecloud.com.br/og-image.png"
                        }
                    }
                ]
            },
            {
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "text": "Terreiro da Cabocla Jurema"
                    }
                ]
            }
        ]
    }
}

url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
req = urllib.request.Request(
    url,
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read().decode())
        print("MENSAGEM ENVIADA COM SUCESSO!", res_data)
except urllib.error.HTTPError as e:
    print(f"Erro ({e.code}):", e.read().decode())
except Exception as e:
    print("Erro:", e)
