import json
import urllib.request
import sys
import datetime
import zoneinfo

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

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

if not wa_token or not phone_number_id:
    print("ERRO: WA_META_TOKEN ou WA_PHONE_NUMBER_ID não configurados.")
    sys.exit(1)

leads_to_reply = [
    {
        "name": "Mãe Cleize De Bara (Seara D'Oxóssi)",
        "phone": "554896710912",
        "lead_id": "115765fa-d3b9-4aba-9a8c-e245f40f2461",
        "conv_id": "7fd97595-6aa7-4513-8bf0-1b0a10cf9763"
    },
    {
        "name": "Centro De Magia (Umbanda e Quimbanda)",
        "phone": "554896456341",
        "lead_id": "04b1d053-371b-41b4-a1a8-dca28d188790",
        "conv_id": "a6903fb6-e5da-484a-898c-dfa11fe88f03"
    }
]

reply_text = """Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!"""

print("=== ENVIANDO RESPOSTA OFICIAL AOS 2 NOVOS INTERESSADOS DE HOJE ===")

for item in leads_to_reply:
    phone = item["phone"]
    conv_id = item["conv_id"]
    contact_name = item["name"]
    lead_id = item["lead_id"]
    print(f"\n--- Enviando para {contact_name} ({phone}) ---")

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
        print(f"❌ Erro ao enviar Meta API: {e}")
        continue

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 2. Registrar no admin_whatsapp_messages
    msg_row = {
        "conversation_id": conv_id,
        "direction": "outbound",
        "message_type": "text",
        "body": reply_text,
        "external_id": wamid,
        "delivery_status": "sent",
        "created_at": now_iso
    }
    req_msg = urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_messages",
        data=json.dumps(msg_row).encode("utf-8"),
        headers=headers_sb,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req_msg) as res:
            pass
        print("✅ Registrado em admin_whatsapp_messages")
    except Exception as e:
        print(f"⚠️ Erro ao registrar msg: {e}")

    # 3. Atualizar admin_whatsapp_conversations
    conv_patch = {
        "last_message_at": now_iso,
        "last_message_preview": reply_text[:140],
        "unread_count": 0
    }
    req_conv = urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}",
        data=json.dumps(conv_patch).encode("utf-8"),
        headers=headers_sb,
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req_conv) as res:
            pass
        print("✅ Conversa atualizada (unread_count = 0)")
    except Exception as e:
        print(f"⚠️ Erro ao atualizar conv: {e}")

    # 4. Atualizar prospecting_leads para 'interested'
    lead_patch = {
        "status": "interested",
        "last_contact_at": now_iso
    }
    req_lead = urllib.request.Request(
        f"{url}/rest/v1/prospecting_leads?id=eq.{lead_id}",
        data=json.dumps(lead_patch).encode("utf-8"),
        headers=headers_sb,
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req_lead) as res:
            pass
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
        f"{url}/rest/v1/prospecting_events",
        data=json.dumps(event_row).encode("utf-8"),
        headers=headers_sb,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req_ev) as res:
            pass
        print("✅ Evento registrado em prospecting_events")
    except Exception as e:
        print(f"⚠️ Erro ao registrar evento: {e}")

print("\n🎉 Todas as respostas foram enviadas e registradas com sucesso!")
