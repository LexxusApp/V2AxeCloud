import json
import urllib.request
import datetime

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers_sb = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}', 'Content-Type': 'application/json'}

conv_id = 'af646dd9-bb57-4798-ba17-8ff59a6c7aee'
wamid = 'wamid.HBgMNTU0Nzg0OTY1NDc3FQIAERgSMTU5RDdDMjREMzE1OUZGQzI4AA=='
reply_text = """Olá, Beatriz! Você pode acessar o Portal do Filho de Santo pelo link direto:
👉 https://axecloud.com.br/entrar?modo=filho

Seus dados de acesso:
• Registro: AXC-2026-162A
• Senha: Os 6 primeiros dígitos do seu CPF (046903)

Axé! 🙏"""

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
req_msg = urllib.request.Request(
    f"{sb_url}/rest/v1/admin_whatsapp_messages",
    data=json.dumps(msg_row).encode("utf-8"),
    headers=headers_sb,
    method="POST"
)
try:
    with urllib.request.urlopen(req_msg) as res:
        print("✅ Registrado em admin_whatsapp_messages!")
except Exception as e:
    print(f"⚠️ Erro ao registrar msg: {e}")

conv_patch = {
    "last_message_at": now_iso,
    "last_message_preview": reply_text[:140],
    "unread_count": 0
}
req_conv = urllib.request.Request(
    f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}",
    data=json.dumps(conv_patch).encode("utf-8"),
    headers=headers_sb,
    method="PATCH"
)
try:
    with urllib.request.urlopen(req_conv) as res:
        print("✅ Conversa atualizada no admin console!")
except Exception as e:
    print(f"⚠️ Erro ao atualizar conv: {e}")
