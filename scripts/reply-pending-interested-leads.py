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
        "name": "Ricardo Marcelo Laurindo",
        "phone": "554896133539",
        "lead_id": None,
        "conv_id": "d8194cd4-ed42-4672-a1f3-e00b9c54f45c"
    },
    {
        "name": "-BAMBAM-",
        "phone": "554888367666",
        "lead_id": None,
        "conv_id": "46e51dcd-c2a7-480c-95f6-816b372e557b"
    },
    {
        "name": "Eduardo tec lights",
        "phone": "554884737314",
        "lead_id": None,
        "conv_id": "507e4cfd-6b47-449e-9d0e-59e6ee0dd5a0"
    },
    {
        "name": "Mauricio Wandelburk",
        "phone": "554792074260",
        "lead_id": None,
        "conv_id": "11b6b0b6-138e-401e-a9e4-bb918b9053e3"
    },
    {
        "name": "Sabrina Thinassi",
        "phone": "556186533014",
        "lead_id": None,
        "conv_id": "1cbe96b8-c5f1-4d4e-b561-2bc7ccd52746"
    }
]

reply_text = """Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!"""

print("=== INICIANDO RESPOSTA AOS 4 NOVOS INTERESSADOS ===")

sp_tz = zoneinfo.ZoneInfo("America/Sao_Paulo")

for item in leads_to_reply:
    phone = item["phone"]
    conv_id = item["conv_id"]
    contact_name = item["name"]
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

    # 2. Registrar no admin_whatsapp_messages
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    msg_row = {
        "conversation_id": conv_id,
        "direction": "outbound",
        "message_type": "text",
        "body": reply_text,
        "external_id": wamid,
        "delivery_status": "sent",
        "created_at": now_iso
    }
    req_sb_msg = urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_messages",
        data=json.dumps(msg_row).encode("utf-8"),
        headers=headers_sb,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req_sb_msg) as res:
            pass
        print("✅ Gravado em admin_whatsapp_messages")
    except Exception as e:
        print(f"⚠️ Erro ao salvar mensagem no DB: {e}")

    # 3. Atualizar admin_whatsapp_conversations
    conv_update = {
        "last_message_at": now_iso,
        "last_message_preview": reply_text[:160],
        "unread_count": 0,
        "updated_at": now_iso
    }
    req_sb_conv = urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}",
        data=json.dumps(conv_update).encode("utf-8"),
        headers=headers_sb,
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req_sb_conv) as res:
            pass
        print("✅ Conversa atualizada em admin_whatsapp_conversations")
    except Exception as e:
        print(f"⚠️ Erro ao atualizar conversa: {e}")

    # 4. Buscar lead em prospecting_leads
    digits = phone[-8:]
    req_get_lead = urllib.request.Request(
        f"{url}/rest/v1/prospecting_leads?phone=like.*{digits}*&select=id,status,name",
        headers=headers_sb
    )
    lead_id = None
    from_status = "contacted"
    lead_name = contact_name
    try:
        with urllib.request.urlopen(req_get_lead) as res:
            leads_found = json.loads(res.read().decode())
        if leads_found:
            lead_id = leads_found[0]["id"]
            from_status = leads_found[0].get("status") or "contacted"
            lead_name = leads_found[0].get("name") or contact_name
    except Exception as e:
        print(f"⚠️ Erro ao buscar lead: {e}")

    if lead_id:
        # Atualizar status para interested
        lead_update = {
            "status": "interested",
            "last_contact_at": now_iso,
            "updated_at": now_iso
        }
        req_up_lead = urllib.request.Request(
            f"{url}/rest/v1/prospecting_leads?id=eq.{lead_id}",
            data=json.dumps(lead_update).encode("utf-8"),
            headers=headers_sb,
            method="PATCH"
        )
        try:
            with urllib.request.urlopen(req_up_lead) as res:
                pass
            print(f"✅ Lead {lead_name} atualizado para status 'interested'")
        except Exception as e:
            print(f"⚠️ Erro ao atualizar status do lead: {e}")

        # Gravar evento em prospecting_events
        event_row = {
            "lead_id": lead_id,
            "event_type": "ai_sales_reply",
            "from_status": from_status,
            "to_status": "interested",
            "description": "Resposta de apresentação e convite para teste de 30 dias enviada via WhatsApp",
            "metadata": {"action": "invite_trial_or_chat", "wamid": wamid},
            "created_at": now_iso
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
            print("✅ Evento gravado em prospecting_events")
        except Exception as e:
            print(f"⚠️ Erro ao gravar evento: {e}")

print("\n=== ENVIO CONCLUÍDO COM SUCESSO! ===")
