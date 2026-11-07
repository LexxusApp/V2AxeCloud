#!/usr/bin/env python3
"""Envia cobranca de assinatura com template atualizado + Pix Copia e Cola em mensagem separada."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"
RECIPIENT_PHONE = "5511920033501"
NOME = "Lucas"
TERREIRO = "Terreiro Teste"
VENCIMENTO = "vence hoje, no dia 12/10/2026"
VALOR = "R$ 6,00"
PIX_COPIA_E_COLA = "00020101021226830014BR.GOV.BCB.PIX2561qrcodespix.sejaefi.com.br/v2/fcdfbc60c86d4759959d071a8ecde08e5204000053039865802BR5905EFISA6008SAOPAULO62070503***6304D51A"


def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def check_template_status(token: str, ver: str, waba: str, name: str) -> str:
    url = f"https://graph.facebook.com/{ver}/{waba}/message_templates?name={name}&fields=name,status"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode())
            for item in data.get("data", []):
                if item.get("name") == name:
                    return str(item.get("status", "")).upper()
    except Exception:
        pass
    return "UNKNOWN"


def send_whatsapp_template(token: str, ver: str, phone_number_id: str, to: str, template_name: str, params: list[str]) -> dict:
    url = f"https://graph.facebook.com/{ver}/{phone_number_id}/messages"
    body = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "pt_BR"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in params],
                }
            ],
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def send_whatsapp_text(token: str, ver: str, phone_number_id: str, to: str, text: str) -> dict:
    url = f"https://graph.facebook.com/{ver}/{phone_number_id}/messages"
    body = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text, "preview_url": False},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> int:
    env = load_env(ENV_PATH)
    token = (env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or "").strip()
    phone_number_id = (env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID") or "").strip()
    waba = (env.get("WA_BUSINESS_ACCOUNT_ID") or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID") or "").strip()
    ver = (env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0").strip()

    if not token or not phone_number_id:
        print("ERRO: Credenciais Meta não encontradas no .env")
        return 1

    # 1. Verifica se cobranca_assinatura_pix_v2_axecloud já foi aprovado
    v2_status = check_template_status(token, ver, waba, "cobranca_assinatura_pix_v2_axecloud")
    print(f"Status cobranca_assinatura_pix_v2_axecloud: {v2_status}")

    if v2_status == "APPROVED":
        template_name = "cobranca_assinatura_pix_v2_axecloud"
        params = [NOME, TERREIRO, VENCIMENTO, VALOR]
    else:
        # Fallback seguro para o template aprovado, informando que o código vai abaixo
        template_name = "cobranca_assinatura_pix_axecloud"
        params = [NOME, TERREIRO, VENCIMENTO, VALOR, "Enviada na mensagem abaixo 👇"]

    print(f"\n[1/2] Enviando template oficial '{template_name}' para {RECIPIENT_PHONE}...")
    try:
        res1 = send_whatsapp_template(token, ver, phone_number_id, RECIPIENT_PHONE, template_name, params)
        print("Template enviado com sucesso!", json.dumps(res1, indent=2))
    except urllib.error.HTTPError as e:
        print(f"Erro ao enviar template ({e.code}): {e.read().decode()}")
        return 1

    print("\nAguardando 1.5s antes do envio do Pix Copia e Cola...")
    time.sleep(1.5)

    # 2. Envio da 2ª mensagem com o código Pix Copia e Cola
    pix_tpl_status = check_template_status(token, ver, waba, "codigo_pix_pagamento_v1_axecloud")
    print(f"\nStatus codigo_pix_pagamento_v1_axecloud: {pix_tpl_status}")

    if pix_tpl_status == "APPROVED":
        print(f"[2/2] Enviando template oficial 'codigo_pix_pagamento_v1_axecloud' para {RECIPIENT_PHONE}...")
        try:
            res2 = send_whatsapp_template(token, ver, phone_number_id, RECIPIENT_PHONE, "codigo_pix_pagamento_v1_axecloud", [PIX_COPIA_E_COLA])
            print("Mensagem Pix (Template) enviada com sucesso!", json.dumps(res2, indent=2))
        except urllib.error.HTTPError as e:
            print(f"Erro ao enviar template Pix ({e.code}): {e.read().decode()}")
            return 1
    else:
        print(f"[2/2] Enviando mensagem de texto isolada com o código Pix para {RECIPIENT_PHONE} (janela 24h)...")
        try:
            res2 = send_whatsapp_text(token, ver, phone_number_id, RECIPIENT_PHONE, PIX_COPIA_E_COLA)
            print("Mensagem Pix enviada com sucesso!", json.dumps(res2, indent=2))
        except urllib.error.HTTPError as e:
            print(f"Erro ao enviar mensagem de texto ({e.code}): {e.read().decode()}")
            return 1

    print("\n=== FLUXO CONCLUÍDO COM SUCESSO! ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
