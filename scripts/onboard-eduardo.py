import urllib.request
import json
import datetime
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

sb_url = env["VITE_SUPABASE_URL"].strip()
sb_key = env["SUPABASE_SERVICE_ROLE_KEY"].strip()
headers_auth = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}", "Content-Type": "application/json"}
wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

email = "edu_alessandro@yahoo.com.br"
phone = "554884737314"
conv_id = "507e4cfd-6b47-449e-9d0e-59e6ee0dd5a0"
nome_terreiro = "Tenda espírita são Jorge guerreiro"
nome_zelador = "Eduardo Alessandro"
temp_password = "Axe@2026"

print("=== 1. CRIANDO USUÁRIO NO SUPABASE AUTH ===")
create_payload = {
    "email": email,
    "password": temp_password,
    "email_confirm": True,
    "user_metadata": {
        "nome_terreiro": nome_terreiro,
        "nome_zelador": nome_zelador,
        "whatsapp": phone,
        "onboarding": "chat_onboarding",
        "is_trial": True,
        "billing_cycle": "monthly"
    }
}

req_user = urllib.request.Request(
    f"{sb_url}/auth/v1/admin/users",
    data=json.dumps(create_payload).encode("utf-8"),
    headers=headers_auth,
    method="POST"
)

user_id = None
try:
    with urllib.request.urlopen(req_user) as resp:
        u_data = json.loads(resp.read().decode())
        user_id = u_data.get("id") or u_data.get("user", {}).get("id")
        print(f"✅ Usuário criado com sucesso! ID: {user_id}")
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f"Auth response: {e.code} - {err_body}")
    # Se já existir, busca pelo e-mail
    if "already" in err_body or e.code == 422:
        # Busca usuário existente
        req_list = urllib.request.Request(f"{sb_url}/auth/v1/admin/users", headers=headers_auth)
        with urllib.request.urlopen(req_list) as resp:
            users_list = json.loads(resp.read().decode()).get("users", [])
            for u in users_list:
                if u.get("email") == email:
                    user_id = u.get("id")
                    print(f"Encontrado usuário existente com ID: {user_id}")
                    break

if not user_id:
    print("❌ Falha ao obter user_id.")
    sys.exit(1)

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)).strftime("%Y-%m-%dT23:59:59+00:00")

print("\n=== 2. CRIANDO / ATUALIZANDO PERFIL_LIDER ===")
perfil_payload = {
    "id": user_id,
    "email": email,
    "nome_terreiro": nome_terreiro,
    "cargo": "Zelador de Santo",
    "zelador": nome_zelador,
    "role": "admin",
    "tenant_id": user_id,
    "whatsapp": phone,
    "is_blocked": False,
    "access_block_reason": None,
    "updated_at": now_iso
}
headers_rest = {**headers_auth, "Prefer": "resolution=merge-duplicates"}
req_prof = urllib.request.Request(
    f"{sb_url}/rest/v1/perfil_lider",
    data=json.dumps(perfil_payload).encode("utf-8"),
    headers=headers_rest,
    method="POST"
)
with urllib.request.urlopen(req_prof) as resp:
    print(f"✅ perfil_lider atualizado: HTTP {resp.status}")

print("\n=== 3. CRIANDO ASSINATURA DE 30 DIAS GRÁTIS EM SUBSCRIPTIONS ===")
sub_payload = {
    "id": user_id,
    "plan": "premium",
    "status": "active",
    "expires_at": expires_at,
    "billing_cycle": "monthly",
    "updated_at": now_iso
}
req_sub = urllib.request.Request(
    f"{sb_url}/rest/v1/subscriptions",
    data=json.dumps(sub_payload).encode("utf-8"),
    headers=headers_rest,
    method="POST"
)
with urllib.request.urlopen(req_sub) as resp:
    print(f"✅ subscriptions atualizado: HTTP {resp.status} (válido até {expires_at})")

print("\n=== 4. ENVIANDO CREDENCIAIS NO WHATSAPP PARA EDUARDO ===")
reply_msg = f"""Axé, Eduardo! 🙏 Seja muito bem-vindo ao AxéCloud!

A conta da *{nome_terreiro}* já está liberada com seus *30 dias grátis* para você testar tudo na prática:

📧 *Seu E-mail:* {email}
🔑 *Sua Senha temporária:* {temp_password}

👉 *Acesse agora seu painel:* https://axecloud.com.br/entrar

(Você pode alterar sua senha a qualquer momento dentro do painel).

Qualquer dúvida ou se precisar de ajuda para cadastrar seus primeiros filhos de santo ou a próxima gira, é só me chamar por aqui! Axé! ✨"""

meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
payload_meta = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": phone,
    "type": "text",
    "text": {"preview_url": True, "body": reply_msg}
}
req_meta = urllib.request.Request(
    meta_url,
    data=json.dumps(payload_meta).encode("utf-8"),
    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req_meta) as res:
    res_data = json.loads(res.read().decode())
wamid = res_data.get("messages", [{}])[0].get("id", "unknown")
print(f"✅ Enviado no WhatsApp com sucesso! WAMID: {wamid}")

print("\n=== 5. REGISTRANDO MENSAGEM NO ADMIN_WHATSAPP_MESSAGES ===")
msg_row = {
    "conversation_id": conv_id,
    "direction": "outbound",
    "message_type": "text",
    "body": reply_msg,
    "external_id": wamid,
    "status": "sent",
    "created_at": now_iso
}
req_sb_msg = urllib.request.Request(
    f"{sb_url}/rest/v1/admin_whatsapp_messages",
    data=json.dumps(msg_row).encode("utf-8"),
    headers=headers_auth,
    method="POST"
)
with urllib.request.urlopen(req_sb_msg) as res:
    print("✅ Gravado em admin_whatsapp_messages")

conv_update = {
    "last_message_at": now_iso,
    "last_message_preview": reply_msg[:160],
    "unread_count": 0,
    "updated_at": now_iso
}
req_sb_conv = urllib.request.Request(
    f"{sb_url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}",
    data=json.dumps(conv_update).encode("utf-8"),
    headers=headers_auth,
    method="PATCH"
)
with urllib.request.urlopen(req_sb_conv) as res:
    print("✅ Conversa atualizada em admin_whatsapp_conversations")

print("\n=== 6. ATUALIZANDO PROSPECTING_LEADS PARA TRIAL ===")
digits = phone[-8:]
req_get_lead = urllib.request.Request(
    f"{sb_url}/rest/v1/prospecting_leads?phone=like.*{digits}*&select=id,status,name",
    headers=headers_auth
)
try:
    with urllib.request.urlopen(req_get_lead) as res:
        leads_found = json.loads(res.read().decode())
    if leads_found:
        lead_id = leads_found[0]["id"]
        req_up = urllib.request.Request(
            f"{sb_url}/rest/v1/prospecting_leads?id=eq.{lead_id}",
            data=json.dumps({"status": "trial", "email": email, "terreiro_id": user_id, "name": nome_terreiro, "updated_at": now_iso}).encode("utf-8"),
            headers=headers_auth,
            method="PATCH"
        )
        with urllib.request.urlopen(req_up) as res:
            print(f"✅ Lead {lead_id} atualizado para status 'trial'")

        event_row = {
            "lead_id": lead_id,
            "event_type": "trial_started",
            "from_status": "interested",
            "to_status": "trial",
            "description": "Cadastro e teste de 30 dias liberado via WhatsApp com sucesso",
            "metadata": {"userId": user_id, "email": email, "wamid": wamid},
            "created_at": now_iso
        }
        req_ev = urllib.request.Request(
            f"{sb_url}/rest/v1/prospecting_events",
            data=json.dumps(event_row).encode("utf-8"),
            headers=headers_auth,
            method="POST"
        )
        with urllib.request.urlopen(req_ev) as res:
            print("✅ Evento trial_started gravado em prospecting_events")
except Exception as e:
    print(f"Aviso lead: {e}")

print("\n🎉 ONBOARDING DO TERREIRO CONCLUÍDO COM SUCESSO!")
