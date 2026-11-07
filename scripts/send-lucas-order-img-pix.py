#!/usr/bin/env python3
"""Verifica aprovacao do template com imagem e dispara teste para Lucas."""
import json
import os
import sys
import time
import urllib.request
import urllib.error

RECIPIENT = "5511920033501"
TEMPLATE_ID = "1408227897958203"
TEMPLATE_NAME = "cobranca_assinatura_pix_order_img_v1"

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

def main():
    env = load_env()
    token = env["WA_META_TOKEN"]
    phone_id = env["WA_PHONE_NUMBER_ID"]
    pix_key = env.get("EFI_PIX_KEY", "c15cbd8d-60f2-49d0-adce-06f3e6d47e82")
    pix_code = "00020101021226830014BR.GOV.BCB.PIX2561qrcodespix.sejaefi.com.br/v2/fcdfbc60c86d4759959d071a8ecde08e5204000053039865802BR5905EFISA6008SAOPAULO62070503***6304D51A"
    media_id = "1159299646430694"

    # Checa status na Meta
    check_url = f"https://graph.facebook.com/v21.0/{TEMPLATE_ID}?fields=name,status,rejected_reason"
    req_check = urllib.request.Request(check_url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req_check) as resp:
            data = json.loads(resp.read().decode())
            status = data.get("status", "UNKNOWN")
            print(f"Template '{TEMPLATE_NAME}' Status: {status}")
            if status != "APPROVED":
                print("Motivo de rejeição (se houver):", data.get("rejected_reason"))
                return 2
    except urllib.error.HTTPError as e:
        print(f"Erro ao checar template ({e.code}): {e.read().decode()}")
        return 1

    # Dispara mensagem
    send_url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
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
                                "id": media_id
                            }
                        }
                    ]
                },
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": "Lucas"},
                        {"type": "text", "text": "Terreiro Teste"},
                        {"type": "text", "text": "vence hoje, no dia 12/10/2026"}
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
                                    "reference_id": f"OR_{int(time.time()*1000)}",
                                    "type": "digital-goods",
                                    "payment_type": "br",
                                    "currency": "BRL",
                                    "total_amount": {
                                        "value": 600,
                                        "offset": 100
                                    },
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
                                                "amount": {"value": 600, "offset": 100},
                                                "quantity": 1
                                            }
                                        ],
                                        "subtotal": {"value": 600, "offset": 100}
                                    }
                                }
                            }
                        }
                    ]
                }
            ]
        }
    }

    req_send = urllib.request.Request(
        send_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req_send) as resp:
            res_data = json.loads(resp.read().decode())
            print(f"Mensagem com banner enviada para {RECIPIENT} com sucesso!")
            print(json.dumps(res_data, indent=2))
            return 0
    except urllib.error.HTTPError as e:
        print(f"Erro ao enviar mensagem ({e.code}): {e.read().decode()}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
