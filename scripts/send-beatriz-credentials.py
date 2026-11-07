import json
import urllib.request
import sys
import datetime

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

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

wa_token = env.get('WA_META_TOKEN')
phone_number_id = env.get('WA_PHONE_NUMBER_ID')

phone = '554784965477'
conv_id = 'af646dd9-bb57-4798-ba17-8ff59a6c7aee'
contact_name = 'Beatriz (Sonnara Beatriz)'

reply_text = """Olá, Beatriz! Você pode acessar o Portal do Filho de Santo pelo link direto:
👉 https://axecloud.com.br/entrar?modo=filho

Seus dados de acesso:
• Registro: AXC-2026-162A
• Senha: Os 6 primeiros dígitos do seu CPF (046903)

Axé! 🙏"""

print(f"=== ENVIANDO RESPOSTA A {contact_name} ({phone}) ===")

# 1. Enviar mensagem via Meta Cloud API
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

try:
    with urllib.request.urlopen(req_meta) as res:
        res_data = json.loads(res.read().decode())
    wamid = res_data.get("messages", [{}])[0].get("id", "unknown")
    print(f"✅ Enviado com sucesso via Meta API! WAMID: {wamid}")
except Exception as e:
    print(f"❌ Erro ao enviar via Meta: {e}")
    sys.exit(1)

# 2. Gravar no admin_whatsapp_messages
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
msg_record = {
    "conversation_id": conv_id,
    "direction": "outbound",
    "body": reply_text,
    "status": "sent",
    "meta_message_id": wamid,
    "created_at": now_iso
}
url_msg = f"{sb_url}/rest/v1/admin_whatsapp_messages"
req_msg = urllib.request.Request(url_msg, data=json.dumps(msg_record).encode(), headers=headers_sb, method="POST")
try:
    with urllib.request.urlopen(req_msg) as res:
        print("✅ Mensagem registrada no banco de dados!")
except Exception as e:
    print(f"⚠️ Erro ao registrar mensagem: {e}")

# 3. Atualizar a conversa para zerar unread_count e atualizar preview
conv_update = {
    "last_message_preview": reply_text[:80],
    "last_message_at": now_iso,
    "unread_count": 0,
    "status": "closed"
}
url_conv = f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}"
req_conv = urllib.request.Request(url_conv, data=json.dumps(conv_update).encode(), headers=headers_sb, method="PATCH")
try:
    with urllib.request.urlopen(req_conv) as res:
        print("✅ Conversa atualizada no admin console!")
except Exception as e:
    print(f"⚠️ Erro ao atualizar conversa: {e}")

print("=== DISPARO CONCLUÍDO COM SUCESSO ===")
