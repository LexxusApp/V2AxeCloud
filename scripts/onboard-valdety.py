import json
import urllib.request
import urllib.error
import datetime
import os
import sys

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
wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

headers_sb = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

email = "valdetygarciapolicarpo97@gmail.com"
nome_zelador = "Valdety Garcia Policarpo"
nome_terreiro = "Tenda de umbanda pai ogum beira mar"
phone = "554898538834"
phone_digits = "4898538834"
conv_id = "1f596c45-0853-4058-8772-179ac2f964b8"
temp_password = "Axe" + str(datetime.datetime.now().year) + "@77!"

print(f"=== INICIANDO ONBOARDING DE {nome_zelador.upper()} ===")

# 1. Baixar os áudios enviados por Valdety para ouvir/salvar
audio_ids = ["1136061902724187", "3360422947679930"]
for aid in audio_ids:
    try:
        req_media = urllib.request.Request(
            f"https://graph.facebook.com/v21.0/{aid}",
            headers={"Authorization": f"Bearer {wa_token}"}
        )
        with urllib.request.urlopen(req_media) as resp:
            m_data = json.loads(resp.read().decode())
        download_url = m_data.get("url")
        if download_url:
            req_dl = urllib.request.Request(
                download_url,
                headers={"Authorization": f"Bearer {wa_token}", "User-Agent": "AxeCloud/2.0"}
            )
            with urllib.request.urlopen(req_dl) as dl_resp:
                audio_bytes = dl_resp.read()
            out_file = f"scripts/valdety_audio_{aid}.ogg"
            with open(out_file, "wb") as af:
                af.write(audio_bytes)
            print(f"✅ Áudio {aid} baixado com sucesso ({len(audio_bytes)} bytes) em {out_file}")
    except Exception as e:
        print(f"⚠️ Erro ao baixar áudio {aid}: {e}")

# 2. Criar usuário no Supabase Auth
print(f"\nCriando conta para {email}...")
auth_payload = {
    "email": email,
    "password": temp_password,
    "email_confirm": True,
    "user_metadata": {
        "nome_terreiro": nome_terreiro,
        "nome_zelador": nome_zelador,
        "whatsapp": phone,
        "onboarding": "chat_auto_onboarding",
        "is_trial": True,
        "billing_cycle": "monthly"
    }
}

user_id = None
try:
    req_auth = urllib.request.Request(
        f"{url}/auth/v1/admin/users",
        data=json.dumps(auth_payload).encode("utf-8"),
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req_auth) as resp:
        res = json.loads(resp.read().decode())
        user_id = res.get("id") or res.get("user", {}).get("id")
        print(f"✅ Usuário Auth criado com sucesso! ID: {user_id}")
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f"⚠️ Erro Auth: {e.code} - {err_body}")
    # Se já existir, buscar o id
    if "already" in err_body or e.code == 422:
        req_find = urllib.request.Request(
            f"{url}/auth/v1/admin/users",
            headers={"apikey": key, "Authorization": f"Bearer {key}"}
        )
        with urllib.request.urlopen(req_find) as resp:
            users_list = json.loads(resp.read().decode()).get("users", [])
            for u in users_list:
                if u.get("email") == email:
                    user_id = u.get("id")
                    print(f"ℹ️ Usuário já existia. Recuperado ID: {user_id}")
                    break

if not user_id:
    print("❌ Falha ao obter user_id. Abortando.")
    sys.exit(1)

# 3. Criar / Atualizar perfil_lider
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
perfil_data = {
    "id": user_id,
    "email": email,
    "nome_terreiro": nome_terreiro,
    "zelador": nome_zelador,
    "cargo": "Dirigente",
    "role": "admin",
    "tenant_id": user_id,
    "whatsapp": phone[:15],
    "is_blocked": False,
    "access_block_reason": None,
    "updated_at": now_iso
}
req_pl = urllib.request.Request(
    f"{url}/rest/v1/perfil_lider",
    data=json.dumps(perfil_data).encode("utf-8"),
    headers={**headers_sb, "Prefer": "resolution=merge-duplicates"},
    method="POST"
)
try:
    with urllib.request.urlopen(req_pl) as resp:
        print("✅ perfil_lider gravado com sucesso!")
except Exception as e:
    print(f"⚠️ Erro ao gravar perfil_lider: {e}")

# 4. Criar assinatura de 30 dias grátis (trial)
expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)).isoformat()
sub_data = {
    "id": user_id,
    "plan": "premium",
    "status": "active",
    "expires_at": expires_at,
    "billing_cycle": "monthly",
    "updated_at": now_iso
}
req_sub = urllib.request.Request(
    f"{url}/rest/v1/subscriptions",
    data=json.dumps(sub_data).encode("utf-8"),
    headers={**headers_sb, "Prefer": "resolution=merge-duplicates"},
    method="POST"
)
try:
    with urllib.request.urlopen(req_sub) as resp:
        print(f"✅ Assinatura criada com 30 dias grátis até {expires_at}!")
except Exception as e:
    print(f"⚠️ Erro ao gravar subscriptions: {e}")

# 5. Atualizar lead no CRM
try:
    req_lead = urllib.request.Request(
        f"{url}/rest/v1/prospecting_leads?phone=ilike.*{phone[-8:]}*",
        data=json.dumps({
            "status": "trial",
            "email": email,
            "terreiro_id": user_id,
            "last_contact_at": now_iso,
            "updated_at": now_iso
        }).encode("utf-8"),
        headers=headers_sb,
        method="PATCH"
    )
    with urllib.request.urlopen(req_lead) as resp:
        print("✅ Lead atualizado para 'trial' no CRM!")
except Exception as e:
    print(f"⚠️ Erro ao atualizar lead: {e}")

# 6. Enviar mensagem com os dados de acesso e acolhimento no WhatsApp
access_message = f"""Axé, Dirigente Valdety! 🙏 Seja muito bem-vindo ao AxéCloud!

A conta da *Tenda de umbanda pai ogum beira mar* já está criada e 100% liberada com **30 dias de cortesia** para você e sua casa!

Seus dados de acesso:
🔗 **Painel:** https://axecloud.com.br/entrar
📧 **E-mail:** {email}
🔑 **Senha temporária:** {temp_password}

*(Você pode alterar sua senha a qualquer momento nas configurações do painel).*

📲 Ouça com calma e comece cadastrando seus primeiros filhos da corrente. Se precisar de qualquer ajuda para configurar, estou à disposição aqui no WhatsApp! Axé para a casa! ✨🌿"""

meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": phone,
    "type": "text",
    "text": {"preview_url": True, "body": access_message}
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
    print(f"✅ Mensagem de acesso enviada com sucesso! WAMID: {wamid}")

    # Gravar em admin_whatsapp_messages
    msg_row = {
        "conversation_id": conv_id,
        "direction": "outbound",
        "message_type": "text",
        "body": access_message,
        "external_id": wamid,
        "status": "sent",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    urllib.request.urlopen(urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_messages",
        data=json.dumps(msg_row).encode("utf-8"),
        headers=headers_sb,
        method="POST"
    ))

    # Atualizar conversa
    urllib.request.urlopen(urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_conversations?id=eq.{conv_id}",
        data=json.dumps({
            "contact_name": "Valdety Garcia Policarpo",
            "last_message_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "last_message_preview": access_message[:160],
            "unread_count": 0,
            "status": "open",
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).encode("utf-8"),
        headers=headers_sb,
        method="PATCH"
    ))
    print("✅ Conversa atualizada no painel administrativo!")
except Exception as e:
    print(f"❌ Erro ao enviar mensagem WhatsApp: {e}")

print("\n=== ONBOARDING CONCLUIDO COM SUCESSO! ===")
