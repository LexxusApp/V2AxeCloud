import json
import urllib.request
import sys
import datetime

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
headers_sb = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

if not wa_token or not phone_number_id:
    print("ERRO: WA_META_TOKEN ou WA_PHONE_NUMBER_ID não configurados.")
    sys.exit(1)

def query(endpoint):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", headers=headers_sb)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def patch(endpoint, data):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", data=json.dumps(data).encode("utf-8"), headers=headers_sb, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def insert(endpoint, data):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", data=json.dumps(data).encode("utf-8"), headers=headers_sb, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

leads_to_answer = [
    {
        "phone": "554796528045",
        "contact_name": "Rosana",
        "terreiro_name": "Terreiro de Umbanda Jacutá Mãe Maria Benedita",
        "tratamento": "Rosana",
    },
    {
        "phone": "554898538834",
        "contact_name": "Zelador(a)",
        "terreiro_name": "Tenda de umbanda pai ogum beira mar",
        "tratamento": "Dirigente",
    }
]

print("=== RESPONDENDO LEADS DO DIA 14/10/2026 ===")

for lead in leads_to_answer:
    phone = lead["phone"]
    terreiro = lead["terreiro_name"]
    tratamento = lead["tratamento"]
    print(f"\n--- Processando: {lead['contact_name']} ({phone}) - {terreiro} ---")

    # Obter conversa
    convs = query(f"admin_whatsapp_conversations?phone_e164=eq.{phone}")
    if not convs:
        print(f"❌ Conversa não encontrada para {phone}")
        continue
    conv = convs[0]
    conv_id = conv["id"]

    reply_text = f"""Axé! 🙏 Que alegria o seu interesse!

O AxéCloud organiza todas as fichas dos filhos da corrente, obrigações litúrgicas, mensalidades com Pix no WhatsApp e aviso automático de giras.

Para liberarmos os seus 30 dias de teste grátis com acesso completo para a *{terreiro}*, me envie por favor:
1️⃣ Seu melhor e-mail para acesso
2️⃣ Seu nome de zelador(a) / dirigente

Se preferir já criar você mesmo(a) em 1 minuto, o link direto é:
👉 https://axecloud.com.br/register

Já fico no aguardo para preparar o seu acesso! ✨"""

    # Enviar Meta Cloud API
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
        print(f"✅ Enviado com sucesso via WhatsApp! WAMID: {wamid}")
    except Exception as e:
        print(f"❌ Erro ao enviar Meta API: {e}")
        continue

    # Registrar em admin_whatsapp_messages
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
    try:
        insert("admin_whatsapp_messages", msg_row)
        print("✅ Gravado em admin_whatsapp_messages")
    except Exception as e:
        print(f"⚠️ Erro ao gravar mensagem: {e}")

    # Atualizar admin_whatsapp_conversations
    conv_update = {
        "last_message_at": now_iso,
        "last_message_preview": reply_text[:160],
        "unread_count": 0,
        "updated_at": now_iso
    }
    try:
        patch(f"admin_whatsapp_conversations?id=eq.{conv_id}", conv_update)
        print("✅ Conversa atualizada (unread_count = 0)")
    except Exception as e:
        print(f"⚠️ Erro ao atualizar conversa: {e}")

    # Atualizar lead em prospecting_leads se existir
    try:
        leads_db = query(f"prospecting_leads?phone=ilike.*{phone[-8:]}*")
        if leads_db:
            lead_id = leads_db[0]["id"]
            patch(f"prospecting_leads?id=eq.{lead_id}", {
                "status": "interested",
                "last_contact_at": now_iso,
                "updated_at": now_iso
            })
            print(f"✅ Lead {lead_id} atualizado para status 'interested'")
    except Exception as e:
        print(f"⚠️ Erro ao atualizar prospecting_leads: {e}")

print("\n=== RESPOSTAS ENVIADAS COM SUCESSO ===")
