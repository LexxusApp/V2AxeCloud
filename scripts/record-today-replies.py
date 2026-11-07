import json
import urllib.request
import datetime

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

sb_url = env["VITE_SUPABASE_URL"].strip()
sb_key = env["SUPABASE_SERVICE_ROLE_KEY"].strip()
headers_sb = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}", "Content-Type": "application/json"}

reply_text = """Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!"""

sent_leads = [
    ("7fd97595-6aa7-4513-8bf0-1b0a10cf9763", "wamid.HBgMNTU0ODk2NzEwOTEyFQIAERgSMzE1NTgzODVCOEE3QzVEQTBFAA=="),
    ("a6903fb6-e5da-484a-898c-dfa11fe88f03", "wamid.HBgMNTU0ODk2NDU2MzQxFQIAERgSMEEzRjc4QUE5MThFN0RCNzU5AA=="),
]

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
for conv_id, wamid in sent_leads:
    msg_row = {
        "conversation_id": conv_id,
        "direction": "outbound",
        "message_type": "text",
        "body": reply_text,
        "external_id": wamid,
        "status": "sent",
        "created_at": now_iso
    }
    req = urllib.request.Request(
        f"{sb_url}/rest/v1/admin_whatsapp_messages",
        data=json.dumps(msg_row).encode("utf-8"),
        headers=headers_sb,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Recorded message for conv {conv_id}: HTTP {resp.status}")
    except Exception as e:
        print(f"Error for conv {conv_id}: {e}")
