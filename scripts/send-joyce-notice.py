import json
import urllib.request
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
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

to = "5511915128744"
nome = "Mãe Joyce"
mensagem = "Identificamos uma instabilidade temporária no acesso hoje. Seu acesso foi 100% restabelecido e liberamos +30 dias de cortesia gratuitos para a T.U. Casa de Oxóssi. Você já pode acessar normalmente pelo portal."

payload = {
    "messaging_product": "whatsapp",
    "to": to,
    "type": "template",
    "template": {
        "name": "aviso_geral_axecloud",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": nome},
                    {"type": "text", "text": mensagem}
                ]
            }
        ]
    }
}

url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print("SUCESSO:", json.dumps(res, indent=2))
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print("ERRO:", e.code, err_body)
