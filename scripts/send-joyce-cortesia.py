import json
import urllib.request
import urllib.error
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
token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN")
phone_id = env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID")
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

to = "5511915128744"
tenant_id = "5de04732-9419-4ef5-8558-7287ed140e79"
nome = "Mãe Joyce"
terreiro = "T.U. Casa de Oxóssi Caridade e Amor"
data_limite = "13/11/2026"

payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "template",
    "template": {
        "name": "cortesia_30dias_axecloud",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": nome},
                    {"type": "text", "text": terreiro},
                    {"type": "text", "text": data_limite}
                ]
            }
        ]
    }
}

send_url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
req_send = urllib.request.Request(
    send_url,
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req_send) as resp:
        res_data = json.loads(resp.read().decode())
        print("Template de cortesia enviado para Joyce com sucesso!")
        print(json.dumps(res_data, indent=2))
        msg_id = res_data.get("messages", [{}])[0].get("id")

        if sb_url and sb_key:
            log_payload = {
                "tenant_id": tenant_id,
                "tipo": "cortesia_30dias",
                "telefone": to,
                "mensagem": f"Template cortesia_30dias_axecloud enviado (+30 dias grátis até {data_limite})",
                "status": "delivered"
            }
            req_log = urllib.request.Request(
                f"{sb_url}/rest/v1/whatsapp_logs",
                data=json.dumps(log_payload).encode("utf-8"),
                headers={
                    "apikey": sb_key,
                    "Authorization": f"Bearer {sb_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req_log) as l_resp:
                print("Log gravado em whatsapp_logs com sucesso.")

except urllib.error.HTTPError as e:
    print(f"Erro ao enviar ({e.code}): {e.read().decode()}")
    sys.exit(1)
