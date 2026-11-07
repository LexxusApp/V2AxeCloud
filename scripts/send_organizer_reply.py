#!/usr/bin/env python3
"""Dispara resposta ao interessado que perguntou sobre quem é o organizador."""
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
token = env.get("WA_META_TOKEN")
phone_id = env.get("WA_PHONE_NUMBER_ID")
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

RECIPIENT = "556293418621"
CONVERSATION_ID = "d9c45fd7-eac1-4d56-bbe2-36827372451d"

MESSAGE_TEXT = (
    "Olá! Axé, tudo bem? 🙏🌿\n\n"
    "Quem está à frente do AxéCloud é o Lucas Siqueira, fundador e idealizador da plataforma.\n\n"
    "O projeto nasceu de dentro do terreiro, com a missão de valorizar e proteger o sagrado através da tecnologia — ajudando os zeladores e dirigentes a organizarem seus filhos de santo, eventos, mensalidades e memórias da casa com total segurança e respeito litúrgico.\n\n"
    "O Lucas faz questão de atender e conversar diretamente com os dirigentes para entender as particularidades de cada casa. Caso queira conversar diretamente com ele, tirar dúvidas, o contato pessoal dele é:\n\n"
    "📲 WhatsApp Pessoal (Lucas Siqueira): (11) 92003-3501\n\n"
    "Estamos 100% à sua disposição."
)

def send_message():
    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": MESSAGE_TEXT
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def log_to_crm(msg_id):
    headers_sb = {
        "apikey": sb_key,
        "Authorization": f"Bearer {sb_key}",
        "Content-Type": "application/json"
    }
    body = {
        "conversation_id": CONVERSATION_ID,
        "direction": "outbound",
        "body": MESSAGE_TEXT,
        "meta_message_id": msg_id,
        "status": "sent"
    }
    req = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages", data=json.dumps(body).encode("utf-8"), headers=headers_sb)
    try:
        urllib.request.urlopen(req)
        print("Mensagem registrada no CRM!")
    except Exception as e:
        print("Erro registrando no CRM:", e)

if __name__ == "__main__":
    if "--send" in sys.argv:
        print(f"Enviando mensagem para {RECIPIENT}...")
        res = send_message()
        msg_id = res.get("messages", [{}])[0].get("id")
        print("Enviado com sucesso! MsgID:", msg_id)
        if msg_id:
            log_to_crm(msg_id)
    else:
        print("Dry run OK. Para enviar execute com --send")
