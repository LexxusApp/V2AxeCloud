import sys
import json
import urllib.request
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
wa_token = env.get("WA_META_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID")

headers_sb = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}

# 1. DISPARAR TEMPLATE OFICIAL DE BOAS VINDAS PARA VALDETY
print("=== 1. DISPARANDO TEMPLATE BOAS_VINDAS_ZELADOR_CONTA_AXECLOUD PARA VALDETY ===")
val_phone = "554898538834"
val_name = "Valdety Garcia Policarpo"
val_terreiro = "Tenda de umbanda pai ogum beira mar"
val_tenant = "7438e2e0-972f-47d8-afa4-45f33d3c8fab"

meta_url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
payload_welcome = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": val_phone,
    "type": "template",
    "template": {
        "name": "boas_vindas_zelador_conta_axecloud",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": val_name}
                ]
            }
        ]
    }
}

req_w = urllib.request.Request(
    meta_url,
    data=json.dumps(payload_welcome).encode("utf-8"),
    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req_w) as res:
        res_data = json.loads(res.read().decode())
    wamid_val = res_data.get("messages", [{}])[0].get("id", "unknown")
    print(f"✅ Template de boas-vindas enviado para Valdety! WAMID: {wamid_val}")

    # Registrar em whatsapp_logs
    log_row = {
        "tenant_id": val_tenant,
        "filho_id": None,
        "tipo": "boas_vindas_zelador",
        "telefone": val_phone,
        "mensagem": "Boas-vindas do zelador enviadas por meta_template (boas_vindas_zelador_conta_axecloud).",
        "status": "sent",
        "external_id": wamid_val,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    urllib.request.urlopen(urllib.request.Request(
        f"{url}/rest/v1/whatsapp_logs",
        data=json.dumps(log_row).encode("utf-8"),
        headers=headers_sb,
        method="POST"
    ))
    print("✅ Gravado em whatsapp_logs!")
except Exception as e:
    print(f"❌ Erro ao enviar boas-vindas: {e}")

# 2. DISPARAR ALERTA DE NOVO CADASTRO PARA O WHATSAPP DO LUCAS (5511920033501)
print("\n=== 2. DISPARANDO ALERTA DE NOVO CADASTRO PARA O LUCAS ===")
lucas_phone = "5511920033501"

payload_ops = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": lucas_phone,
    "type": "template",
    "template": {
        "name": "novo_cadastro_terreiro_ops_axecloud",
        "language": {"code": "pt_BR"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": val_terreiro},
                    {"type": "text", "text": val_name},
                    {"type": "text", "text": "valdetygarciapolicarpo97@gmail.com · WhatsApp 4898538834 · origem chat-whatsapp"}
                ]
            }
        ]
    }
}

req_ops = urllib.request.Request(
    meta_url,
    data=json.dumps(payload_ops).encode("utf-8"),
    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req_ops) as res:
        res_data = json.loads(res.read().decode())
    wamid_lucas = res_data.get("messages", [{}])[0].get("id", "unknown")
    print(f"✅ Alerta de novo terreiro enviado para o Lucas! WAMID: {wamid_lucas}")
except urllib.error.HTTPError as e:
    print(f"❌ Erro HTTP ao enviar alerta ops para o Lucas: {e.code} - {e.read().decode()}")
    try:
        req_tmpl = urllib.request.Request(
            f"https://graph.facebook.com/v21.0/{env.get('WA_BUSINESS_ACCOUNT_ID')}/message_templates?name=novo_cadastro_terreiro_ops_axecloud",
            headers={"Authorization": f"Bearer {wa_token}"}
        )
        with urllib.request.urlopen(req_tmpl) as resp:
            t_data = json.loads(resp.read().decode())
        print("COMPONENTS DO TEMPLATE NO META:", json.dumps(t_data['data'][0]['components'], indent=2, ensure_ascii=False))
    except Exception as ex:
        print(f"Erro ao buscar template: {ex}")
except Exception as e:
    print(f"❌ Erro ao enviar alerta ops para o Lucas: {e}")
