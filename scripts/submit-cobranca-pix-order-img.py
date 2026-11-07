#!/usr/bin/env python3
"""Faz upload do banner do usuario e submete o template cobranca_assinatura_pix_order_img_v1."""
import json
import os
import sys
import urllib.request
import urllib.error

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
    env = load_env(".env")
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN")
    waba = env.get("WA_BUSINESS_ACCOUNT_ID") or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"

    img_path = "public/banner-assinatura-pix.jpg"
    img_size = os.path.getsize(img_path)
    print(f"1. Fazendo upload da imagem ({img_path}, {img_size} bytes)...")

    # 1. Cria sessão de upload na Meta
    upload_session_url = f"https://graph.facebook.com/{ver}/app/uploads?file_length={img_size}&file_type=image/jpeg&access_token={token}"
    req_upload = urllib.request.Request(upload_session_url, method="POST")
    try:
        with urllib.request.urlopen(req_upload) as resp:
            session_data = json.loads(resp.read().decode())
            upload_id = session_data["id"]
    except urllib.error.HTTPError as e:
        print(f"Erro ao criar sessao de upload ({e.code}): {e.read().decode()}")
        return 1

    print(f"Sessão criada: {upload_id}")

    # 2. Envia os bytes da imagem
    with open(img_path, "rb") as f:
        img_bytes = f.read()

    upload_url = f"https://graph.facebook.com/{ver}/{upload_id}"
    req_file = urllib.request.Request(upload_url, data=img_bytes, method="POST")
    req_file.add_header("Authorization", f"OAuth {token}")
    req_file.add_header("file_offset", "0")
    req_file.add_header("Content-Type", "image/jpeg")

    try:
        with urllib.request.urlopen(req_file) as resp:
            file_res = json.loads(resp.read().decode())
            file_handle = file_res["h"]
    except urllib.error.HTTPError as e:
        print(f"Erro ao enviar bytes ({e.code}): {e.read().decode()}")
        return 1

    print(f"Handle obtido: {file_handle}")

    # 3. Define o template com HEADER IMAGE + ORDER_DETAILS
    template_name = "cobranca_assinatura_pix_order_img_v1"
    template_data = {
        "name": template_name,
        "language": "pt_BR",
        "category": "UTILITY",
        "components": [
            {
                "type": "HEADER",
                "format": "IMAGE",
                "example": {
                    "header_handle": [file_handle]
                }
            },
            {
                "type": "BODY",
                "text": "Olá, {{1}}.\n\nA assinatura do seu terreiro {{2}} {{3}}.\nMantenha sua assinatura em dia para não perder o acesso ao sistema.\n\nCopie e cole o código PIX abaixo para efetuar o pagamento instantâneo.",
                "example": {
                    "body_text": [["Lucas", "Terreiro Teste", "vence hoje, no dia 12/10/2026"]]
                }
            },
            {
                "type": "FOOTER",
                "text": "Caso tenha dúvida, basta responder esta mensagem."
            },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "ORDER_DETAILS",
                        "text": "Copy Pix code"
                    }
                ]
            }
        ]
    }

    print(f"\n2. Submetendo template '{template_name}' para WABA {waba}...")
    submit_url = f"https://graph.facebook.com/{ver}/{waba}/message_templates"
    req_submit = urllib.request.Request(
        submit_url,
        data=json.dumps(template_data, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req_submit) as resp:
            res_data = json.loads(resp.read().decode())
            print("Template submetido com sucesso!", json.dumps(res_data, indent=2))
            return 0
    except urllib.error.HTTPError as e:
        print(f"Erro ao submeter template ({e.code}): {e.read().decode()}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
