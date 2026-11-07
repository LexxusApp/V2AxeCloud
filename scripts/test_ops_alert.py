import urllib.request
import urllib.error
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
phone_id = env.get("WA_PHONE_NUMBER_ID")
RECIPIENT = "5511920033501" # Lucas's phone

raw_terreiro = "Tellysleo@gmail.com \n Ile alaketu ase dan borun"
raw_zelador = "Babalorixa Leandro"
raw_email = "tellysleo@gmail.com"
raw_wa = "556283173503"

print("1. Testando com o nome_terreiro ORIGINAL (com newline)...")
payload_with_newline = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": RECIPIENT,
    "type": "template",
    "template": {
        "name": "novo_cadastro_terreiro_ops_axecloud",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": raw_terreiro},
                    {"type": "text", "text": raw_zelador},
                    {"type": "text", "text": f"E-mail: {raw_email} · WhatsApp: {raw_wa} · origem site"}
                ]
            }
        ]
    }
}

req1 = urllib.request.Request(
    f"https://graph.facebook.com/v21.0/{phone_id}/messages",
    data=json.dumps(payload_with_newline).encode("utf-8"),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req1) as resp:
        print("Envio 1 deu:", resp.read().decode())
except urllib.error.HTTPError as e:
    print(f"Envio 1 FALHOU como esperado ({e.code}):", e.read().decode())

print("\n2. Testando com o nome_terreiro LIMPO (sem newline)...")
clean_terreiro = " ".join(raw_terreiro.split())
payload_clean = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": RECIPIENT,
    "type": "template",
    "template": {
        "name": "novo_cadastro_terreiro_ops_axecloud",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": clean_terreiro},
                    {"type": "text", "text": raw_zelador},
                    {"type": "text", "text": f"E-mail: {raw_email} · WhatsApp: {raw_wa} · origem site"}
                ]
            }
        ]
    }
}

req2 = urllib.request.Request(
    f"https://graph.facebook.com/v21.0/{phone_id}/messages",
    data=json.dumps(payload_clean).encode("utf-8"),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req2) as resp:
        print("Envio 2 SUCESSO:", resp.read().decode())
except urllib.error.HTTPError as e:
    print(f"Envio 2 FALHOU ({e.code}):", e.read().decode())
