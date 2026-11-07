import urllib.request
import json
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
    ("d8194cd4-ed42-4672-a1f3-e00b9c54f45c", "wamid.HBgMNTU0ODk2MTMzNTM5FQIAERgSMTQ1MTc5ODg4N0UxNTFDOTQ2AA=="),
    ("46e51dcd-c2a7-480c-95f6-816b372e557b", "wamid.HBgMNTU0ODg4MzY3NjY2FQIAERgSQzExNDRCQ0QyNjFBMUYxM0ZGAA=="),
    ("507e4cfd-6b47-449e-9d0e-59e6ee0dd5a0", "wamid.HBgMNTU0ODg0NzM3MzE0FQIAERgSREVGMUQ0NENCQUFENjE2NkE3AA=="),
    ("11b6b0b6-138e-401e-a9e4-bb918b9053e3", "wamid.HBgMNTU0NzkyMDc0MjYwFQIAERgSMDFDQzI0OEZDOUM1OTNDNjE1AA=="),
    ("1cbe96b8-c5f1-4d4e-b561-2bc7ccd52746", "wamid.HBgMNTU2MTg2NTMzMDE0FQIAERgSMzFBNENFQ0NCRDE0MkE3QTA2AA=="),
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
