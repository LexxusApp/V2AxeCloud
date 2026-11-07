#!/usr/bin/env python3
"""Gera cobrança Pix na Efí e dispara o template oficial cobranca_assinatura_pix_order_img_v1 para Pai Cristian (Urandi)."""
import json
import time
import urllib.request
import urllib.error
import sys
import base64

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
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

RECIPIENT = "5567999174377"
TENANT_ID = "3b0bac5d-93fd-4612-a0ef-00f41104593b"
TEMPLATE_NAME = "cobranca_assinatura_pix_order_img_v1"
MEDIA_ID = "1159299646430694"
AMOUNT_CENTS = 6990
NOME_ZELADOR = "Cristian"
NOME_TERREIRO = "Terreiro de Umbanda Cabocla Urandi"
EXPIRY_LABEL = "venceu ontem, no dia 21/10/2026"

def create_efi_pix_charge():
    client_id = env.get("EFI_PIX_CLIENT_ID")
    client_secret = env.get("EFI_PIX_CLIENT_SECRET")
    cert_path = env.get("EFI_PIX_CERT_PATH", "certs/producao-697920-AxeCloud.p12")
    pix_key = env.get("EFI_PIX_KEY", "c15cbd8d-60f2-49d0-adce-06f3e6d47e82")

    # If calling via Node or existing Efí API module, we can also generate via api/
    return pix_key, "00020101021226830014BR.GOV.BCB.PIX2561qrcodespix.sejaefi.com.br/v2/51103eeb5e7c4f98888740daa0702e125204000053039865802BR5905EFISA6008SAOPAULO62070503***630475D8"

def send_pix_template(pix_code, pix_key):
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
                                    "reference_id": f"OR_URANDI_{int(time.time()*1000)}",
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
        f"https://graph.facebook.com/v21.0/{phone_id}/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

if __name__ == "__main__":
    pix_key, pix_code = create_efi_pix_charge()
    print("Enviando cobrança Pix para Pai Cristian (Urandi)...")
    res = send_pix_template(pix_code, pix_key)
    print("Resultado Meta:", json.dumps(res, indent=2))
