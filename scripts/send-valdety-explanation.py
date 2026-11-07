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
wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

phone = "554898538834"
conv_id = "1f596c45-0853-4058-8772-179ac2f964b8"

explain_text = """Dirigente Valdety, ouvindo seus áudios, vou te explicar de forma bem simples e prática: 😊

O AxéCloud é um aplicativo e painel feito exclusivamente para terreiros de Umbanda e Candomblé. Ele serve para:

1️⃣ **Ficha dos Médiuns:** Guardar os dados de cada filho da corrente (orixás, guias, obrigações cumpridas, batismo e dados de contato).
2️⃣ **Mensalidades da Casa:** Organiza o financeiro do terreiro, gerando o Pix e lembretes automáticos no WhatsApp dos filhos.
3️⃣ **Avisos de Gira:** Avisa os médiuns sobre as próximas giras e eles confirmam presença direto pelo WhatsApp.

Já deixei tudo configurado para a *Tenda de umbanda pai ogum beira mar* com 30 dias de teste grátis, sem cartão nem compromisso. 

Pode clicar no link que te enviei acima para ver como é fácil! Qualquer dúvida, pode me perguntar por aqui que vou te orientando! 🙏🌿"""

meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": phone,
    "type": "text",
    "text": {"preview_url": True, "body": explain_text}
}
req = urllib.request.Request(
    meta_url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req) as res:
    res_data = json.loads(res.read().decode())
wamid = res_data.get("messages", [{}])[0].get("id", "unknown")
print(f"Mensagem explicativa enviada para Valdety: {wamid}")

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
msg_row = {
    "conversation_id": conv_id,
    "direction": "outbound",
    "message_type": "text",
    "body": explain_text,
    "external_id": wamid,
    "status": "sent",
    "created_at": now_iso
}
req_m = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_messages",
    data=json.dumps(msg_row).encode("utf-8"),
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    method="POST"
)
urllib.request.urlopen(req_m)

req_c = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}",
    data=json.dumps({
        "last_message_at": now_iso,
        "last_message_preview": explain_text[:160],
        "unread_count": 0,
        "updated_at": now_iso
    }).encode("utf-8"),
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    method="PATCH"
)
urllib.request.urlopen(req_c)
print("Conversa atualizada com sucesso!")
