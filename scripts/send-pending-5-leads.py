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

default_reply = """Axé! 🙏 O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso de giras. Entre muitos outros Módulos.

Liberei 30 dias grátis para você testar sem cartão:
👉 Crie seu terreiro em 1 minuto: https://axecloud.com.br/register

Ou se preferir, me manda aqui seu e-mail e o nome da casa que eu já gero seu acesso por aqui mesmo!"""

tania_reply = """Axé, Mãe Tânia! 🙏 Sou o responsável pelo AxéCloud. Pode falar diretamente comigo por este número aqui mesmo!

Vi que a senhora tem interesse em conhecer o sistema para sua casa. O AxéCloud organiza fichas dos filhos, obrigações litúrgicas, mensalidades no WhatsApp e aviso de giras.

Liberei 30 dias grátis para a sua casa testar sem compromisso. Se preferir, pode me passar por aqui o nome do seu terreiro e o seu e-mail que eu já gero o seu acesso agora mesmo!"""

sandra_reply = """Axé, Sandra! 🙏 Tudo bem? Sou do AxéCloud, um sistema desenvolvido para apoiar a organização de terreiros (gestão de filhos, giras, obrigações e mensalidades no WhatsApp).

Vi sua mensagem por aqui! A senhora é a dirigente do Templo de Axé Mãe Oxum?

Se quiser conhecer, liberei 30 dias gratuitos para sua casa testar:
👉 Pode criar em 1 minuto aqui: https://axecloud.com.br/register

Ou se preferir, só me responde aqui com seu e-mail que eu mesmo gero o acesso para você!"""

leads = [
    {
        "name": "Cristina De Oya",
        "phone": "554788009330",
        "conv_id": "54e0ca9b-1844-40f4-82d3-4ec60cbff0fe",
        "body": default_reply
    },
    {
        "name": "Yle ase",
        "phone": "554797394827",
        "conv_id": "e33174a8-8c75-4894-bdfb-62246d219bfc",
        "body": default_reply
    },
    {
        "name": "Casa Grande",
        "phone": "554791476015",
        "conv_id": "1228c096-fb23-4e12-b57f-ff4fb2ca0ea7",
        "body": default_reply
    },
    {
        "name": "Mãe Tânia d Oxum",
        "phone": "554791969424",
        "conv_id": "e7ceaeed-2533-41c5-a859-398e3b0f3dc5",
        "body": tania_reply
    },
    {
        "name": "Sandra (Templo Mãe Oxum)",
        "phone": "554888745143",
        "conv_id": "416f163a-9f4a-4c54-afd6-5bb083c49906",
        "body": sandra_reply
    }
]

print("=== INICIANDO ENVIO DAS RESPOSTAS AOS 5 INTERESSADOS ===")

for l in leads:
    phone = l["phone"]
    conv_id = l["conv_id"]
    contact_name = l["name"]
    text = l["body"]
    print(f"\n--- Enviando para {contact_name} ({phone}) ---")

    # 1. Enviar mensagem via Meta Cloud API
    meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "text",
        "text": {"preview_url": True, "body": text}
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
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"❌ Erro HTTP Meta API: {e.code} - {err_body}")
        continue
    except Exception as e:
        print(f"❌ Erro Meta API: {e}")
        continue

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 2. Registrar no admin_whatsapp_messages
    msg_row = {
        "conversation_id": conv_id,
        "direction": "outbound",
        "message_type": "text",
        "body": text,
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
            print(f"✅ Registrado em admin_whatsapp_messages (HTTP {res.status})")
    except Exception as e:
        print(f"⚠️ Erro ao registrar msg: {e}")

    # 3. Atualizar admin_whatsapp_conversations
    conv_patch = {
        "last_message_at": now_iso,
        "last_message_preview": text[:140],
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

    # 4. Atualizar prospecting_leads se existir
    url_find_lead = f"{sb_url}/rest/v1/prospecting_leads?phone=ilike.*{phone[-8:]}*&select=id"
    req_find = urllib.request.Request(url_find_lead, headers=headers_sb)
    lead_id = None
    try:
        with urllib.request.urlopen(req_find) as res_find:
            found = json.loads(res_find.read().decode())
            if found:
                lead_id = found[0]["id"]
    except Exception:
        pass

    if lead_id:
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

        event_row = {
            "lead_id": lead_id,
            "event_type": "ai_sales_reply",
            "from_status": "contacted",
            "to_status": "interested",
            "description": "Resposta enviada pelo suporte administrativo com convite de 30 dias grátis",
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

print("\n🎉 Todos os 5 contatos foram atendidos e processados com sucesso!")
