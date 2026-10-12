#!/usr/bin/env python3
"""Dispara o template oficial de cobranca de assinatura Pix com imagem para Joyce Nugerini."""
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
token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN")
phone_id = env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID")
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

if not token or not phone_id:
    print("Erro: credenciais Meta ausentes.")
    sys.exit(1)

RECIPIENT = "5511915128744"
TENANT_ID = "5de04732-9419-4ef5-8558-7287ed140e79"
TEMPLATE_NAME = "cobranca_assinatura_pix_order_img_v1"
MEDIA_ID = "1159299646430694"
PIX_KEY = env.get("EFI_PIX_KEY", "c15cbd8d-60f2-49d0-adce-06f3e6d47e82")
PIX_CODE = "00020101021226830014BR.GOV.BCB.PIX2561qrcodespix.sejaefi.com.br/v2/51103eeb5e7c4f98888740daa0702e125204000053039865802BR5905EFISA6008SAOPAULO62070503***630475D8"
AMOUNT_CENTS = 6990 # R$ 69,90
EXPIRY_LABEL = "vence hoje, no dia 12/10/2026"

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
                "parameters": [
                    {
                        "type": "image",
                        "image": {
                            "id": MEDIA_ID
                        }
                    }
                ]
            },
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": "Joyce"},
                    {"type": "text", "text": "T.U. Casa de Oxóssi Caridade e Amor"},
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
                                "reference_id": f"OR_SUB_{int(time.time()*1000)}",
                                "type": "digital-goods",
                                "payment_type": "br",
                                "currency": "BRL",
                                "total_amount": {
                                    "value": AMOUNT_CENTS,
                                    "offset": 100
                                },
                                "payment_settings": [
                                    {
                                        "type": "pix_dynamic_code",
                                        "pix_dynamic_code": {
                                            "code": PIX_CODE,
                                            "merchant_name": "AxéCloud",
                                            "key": PIX_KEY,
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

send_url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
req_send = urllib.request.Request(
    send_url,
    data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req_send) as resp:
        res_data = json.loads(resp.read().decode())
        print(f"Template de cobrança enviado para Joyce ({RECIPIENT}) com sucesso!")
        print(json.dumps(res_data, indent=2))
        msg_id = res_data.get("messages", [{}])[0].get("id")

        # Registra log no Supabase
        if sb_url and sb_key:
            log_payload = {
                "tenant_id": TENANT_ID,
                "tipo": "cobranca_assinatura",
                "telefone": RECIPIENT,
                "mensagem": f"Cobrança de assinatura enviada (vencimento hoje 12/10/2026, R$ 69,90) com banner e Pix copia e cola. [ASSINATURA:2026-10-12:D-0]",
                "status": "delivered"
            }
            req_log = urllib.request.Request(
                f"{sb_url}/rest/v1/whatsapp_logs",
                data=json.dumps(log_payload).encode("utf-8"),
                headers={
                    "apikey": sb_key,
                    "Authorization": f"Bearer {sb_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req_log) as l_resp:
                print("Log gravado em whatsapp_logs com sucesso.")

except urllib.error.HTTPError as e:
    print(f"Erro ao enviar ({e.code}): {e.read().decode()}")
    sys.exit(1)
except Exception as e:
    print(f"Erro inesperado: {e}")
    sys.exit(1)
