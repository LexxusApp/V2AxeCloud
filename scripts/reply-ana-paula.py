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

phone = '554799498604'
conv_id = '8b2fa64b-ebae-445e-a0e3-3d7c5a2c6dd7'
lead_id = '9f4df822-6cb6-4c5a-bb75-9b35550240b5'
contact_name = 'Ana Paula (Terreiro de Umbanda - Ilê Axé Nanã Buruque)'

reply_text = """Axé, Ana Paula! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!"""

print(f"=== ENVIANDO RESPOSTA OFICIAL A {contact_name} ===")

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

with urllib.request.urlopen(req_meta) as res:
    res_data = json.loads(res.read().decode())
wamid = res_data.get("messages", [{}])[0].get("id", "unknown")
print(f"✅ Enviado com sucesso via Meta API! WAMID: {wamid}")

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

# 2. Registrar no admin_whatsapp_messages
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
        print(f"✅ Registrado em admin_whatsapp_messages: HTTP {res.status}")
except Exception as e:
    print(f"⚠️ Erro ao registrar msg: {e}")

# 3. Atualizar admin_whatsapp_conversations
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
        print("✅ Conversa atualizada no admin (unread_count = 0)")
except Exception as e:
    print(f"⚠️ Erro ao atualizar conv: {e}")

# 4. Atualizar prospecting_leads para 'interested'
lead_patch = {
    "status": "interested",
    "last_contact_at": now_iso
}
req_lead = urllib.request.Request(
    f"{sb_url}/rest/v1/prospecting_leads?id=eq.{lead_id}",
    data=json.dumps(lead_patch).encode("utf-8"),
    headers=headers_sb,
    method="PATCH"
)
try:
    with urllib.request.urlopen(req_lead) as res:
        print("✅ Lead atualizado para status 'interested'")
except Exception as e:
    print(f"⚠️ Erro ao atualizar lead: {e}")

# 5. Registrar evento em prospecting_events
event_row = {
    "lead_id": lead_id,
    "event_type": "ai_sales_reply",
    "from_status": "contacted",
    "to_status": "interested",
    "description": "Resposta oficial enviada com link de cadastro e oferta de 30 dias grátis",
    "created_at": now_iso,
    "metadata": {"wamid": wamid, "action": "sent_free_trial_invite"}
}
req_ev = urllib.request.Request(
    f"{sb_url}/rest/v1/prospecting_events",
    data=json.dumps(event_row).encode("utf-8"),
    headers=headers_sb,
    method="POST"
)
try:
    with urllib.request.urlopen(req_ev) as res:
        print("✅ Evento registrado em prospecting_events")
except Exception as e:
    print(f"⚠️ Erro ao registrar evento: {e}")

print("🎉 Finalizado com sucesso!")
