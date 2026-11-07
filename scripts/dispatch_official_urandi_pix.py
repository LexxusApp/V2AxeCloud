#!/usr/bin/env python3
"""Gera cobrança Pix na Efí (produção) e dispara o template oficial cobranca_assinatura_pix_order_img_v1 para Pai Cristian (Urandi)."""
import json
import time
import urllib.request
import urllib.error
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
token = env.get("WA_META_TOKEN")
phone_id = env.get("WA_PHONE_NUMBER_ID")
sb_url = env.get("VITE_SUPABASE_URL")
sb_anon = env.get("VITE_SUPABASE_ANON_KEY")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

RECIPIENT = "5567999174377"
TENANT_ID = "3b0bac5d-93fd-4612-a0ef-00f41104593b"
TEMPLATE_NAME = "cobranca_assinatura_pix_order_img_v1"
MEDIA_ID = "1899751394737608" # Freshly uploaded banner ID
AMOUNT_CENTS = 6990
NOME_ZELADOR = "Cristian"
NOME_TERREIRO = "Terreiro de Umbanda Cabocla Urandi"
EXPIRY_LABEL = "venceu ontem, no dia 21/10/2026"
PIX_KEY = env.get("EFI_PIX_KEY", "c15cbd8d-60f2-49d0-adce-06f3e6d47e82")

headers_sb = {
    "apikey": sb_key,
    "Authorization": f"Bearer {sb_key}",
    "Content-Type": "application/json"
}

def get_admin_token():
    print("1. Autenticando como Admin Global...")
    login_url = f"{sb_url}/auth/v1/token?grant_type=password"
    req_login = urllib.request.Request(
        login_url,
        data=json.dumps({"email": "lucasilvasiqueira@outlook.com.br", "password": "AxeCloud@2026Admin"}).encode("utf-8"),
        headers={"apikey": sb_anon, "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_login) as resp:
        return json.loads(resp.read().decode())["access_token"]

def generate_prod_pix(admin_token):
    print("2. Solicitando geração de Pix dinâmico à API de produção...")
    checkout_url = "https://axecloud.com.br/api/v1/checkout/efi/pix"
    body = {
        "tenantId": TENANT_ID,
        "billingCycle": "monthly",
        "purpose": "renewal"
    }
    req_checkout = urllib.request.Request(
        checkout_url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 AxéCloud Official Billing Dispatch"
        }
    )
    with urllib.request.urlopen(req_checkout) as resp:
        res = json.loads(resp.read().decode())
        txid = res.get("txid")
        copypaste = res.get("copyPaste")
        status = res.get("status")
        print(f"   -> Pix gerado com sucesso! TxID: {txid} | Status: {status}")
        return txid, copypaste

def send_pix_template(pix_code, pix_key, txid):
    print(f"3. Disparando template oficial '{TEMPLATE_NAME}' via Meta Cloud API para {RECIPIENT}...")
    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT,
        "type": "template",
        "template": {
            "name": TEMPLATE_NAME,
            "language": {"code": "pt_BR"},
            "components": [
                {
                    "type": "header",
                    "parameters": [{"type": "image", "image": {"id": MEDIA_ID}}]
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": NOME_ZELADOR},
                        {"type": "text", "text": NOME_TERREIRO},
                        {"type": "text", "text": EXPIRY_LABEL}
                    ]
                },
                {
                    "type": "button",
                    "sub_type": "order_details",
                    "index": 0,
                    "parameters": [
                        {
                            "type": "action",
                            "action": {
                                "order_details": {
                                    "reference_id": f"OR_URANDI_{txid[:18]}",
                                    "type": "digital-goods",
                                    "payment_type": "br",
                                    "currency": "BRL",
                                    "total_amount": {"value": AMOUNT_CENTS, "offset": 100},
                                    "payment_settings": [
                                        {
                                            "type": "pix_dynamic_code",
                                            "pix_dynamic_code": {
                                                "code": pix_code,
                                                "merchant_name": "AxéCloud",
                                                "key": pix_key,
                                                "key_type": "EVP"
                                            }
                                        }
                                    ],
                                    "order": {
                                        "status": "pending",
                                        "items": [
                                            {
                                                "retailer_id": "axecloud-premium",
                                                "name": "Plano Premium AxéCloud",
                                                "amount": {"value": AMOUNT_CENTS, "offset": 100},
                                                "quantity": 1
                                            }
                                        ],
                                        "subtotal": {"value": AMOUNT_CENTS, "offset": 100}
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        msg_id = data.get("messages", [{}])[0].get("id")
        return msg_id

def log_whatsapp(msg_id, txid):
    print("4. Registrando disparo em whatsapp_logs...")
    url = f"{sb_url}/rest/v1/whatsapp_logs"
    body = {
        "tenant_id": TENANT_ID,
        "telefone": RECIPIENT,
        "tipo": "cobranca_assinatura",
        "mensagem": f"ASSINATURA:2026-10-21:D-0 | Template: {TEMPLATE_NAME} | TxID: {txid}",
        "status": "delivered",
        "meta_message_id": msg_id
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers_sb)
    with urllib.request.urlopen(req) as resp:
        print("   -> Log registrado com sucesso no banco!")

def main():
    print("=== INICIANDO DISPARO DO PIX OFICIAL PARA PAI CRISTIAN (URANDI) ===")
    admin_token = get_admin_token()
    txid, copypaste = generate_prod_pix(admin_token)
    msg_id = send_pix_template(copypaste, PIX_KEY, txid)
    print(f"Mensagem enviada com sucesso pela Meta! Meta Message ID: {msg_id}")
    log_whatsapp(msg_id, txid)
    print(">>> FINALIZADO COM SUCESSO! <<<")

if __name__ == "__main__":
    main()
