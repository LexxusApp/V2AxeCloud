import json
import urllib.request
import datetime

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
url = env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers_sb = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}

wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

phone = "554898538834"
conv_id = "1f596c45-0853-4058-8772-179ac2f964b8"
terreiro = "Tenda de umbanda pai ogum beira mar"

reply_text = "Boa tarde! Axé! 🙏\n\nComo posso te chamar? Me passa por favor o seu nome e o seu melhor e-mail que já libero agora mesmo o seu acesso de 30 dias grátis para a *Tenda de umbanda pai ogum beira mar*!"

meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": phone,
    "type": "text",
    "text": {"preview_url": True, "body": reply_text}
}

req_meta = urllib.request.Request(
    meta_url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req_meta) as res:
    res_data = json.loads(res.read().decode())
wamid = res_data.get("messages", [{}])[0].get("id", "unknown")
print(f"Enviado para {phone}: {wamid}")

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
msg_row = {
    "conversation_id": conv_id,
    "direction": "outbound",
    "message_type": "text",
    "body": reply_text,
    "external_id": wamid,
    "status": "sent",
    "created_at": now_iso
}
req_msg = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_messages", data=json.dumps(msg_row).encode("utf-8"), headers=headers_sb, method="POST")
urllib.request.urlopen(req_msg)

req_conv = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}", data=json.dumps({
    "last_message_at": now_iso,
    "last_message_preview": reply_text[:160],
    "unread_count": 0,
    "updated_at": now_iso
}).encode("utf-8"), headers=headers_sb, method="PATCH")
urllib.request.urlopen(req_conv)
print("Conversa e mensagem sincronizadas com sucesso!")
