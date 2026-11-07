import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse

def load_env(path):
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
    env = load_env("AxecloudV2/.env")
    token = env["WA_META_TOKEN"]
    waba = env["WA_BUSINESS_ACCOUNT_ID"]
    ver = "v21.0"
    
    img_path = "AxecloudV2/public/og-image.png"
    img_size = os.path.getsize(img_path)
    print(f"1. Fazendo upload da imagem de exemplo ({img_path}, {img_size} bytes)...")
    
    # 1. Cria sessão de upload
    upload_session_url = f"https://graph.facebook.com/{ver}/app/uploads?file_length={img_size}&file_type=image/png&access_token={token}"
    req_upload = urllib.request.Request(upload_session_url, method="POST")
    with urllib.request.urlopen(req_upload) as resp:
        session_data = json.loads(resp.read().decode())
        upload_id = session_data["id"]
        
    print(f"Sessão criada: {upload_id}")
    
    # 2. Envia os bytes da imagem
    with open(img_path, "rb") as f:
        img_bytes = f.read()
    
    upload_url = f"https://graph.facebook.com/{ver}/{upload_id}"
    req_file = urllib.request.Request(upload_url, data=img_bytes, method="POST")
    req_file.add_header("Authorization", f"OAuth {token}")
    req_file.add_header("file_offset", "0")
    req_file.add_header("Content-Type", "image/png")
    
    with urllib.request.urlopen(req_file) as resp:
        file_res = json.loads(resp.read().decode())
        file_handle = file_res["h"]
        
    print(f"Handle obtido: {file_handle}")
    
    # 3. Define o template com HEADER IMAGE
    template_name = "axecloud_prospeccao_imagem_v1"
    template_data = {
        "name": template_name,
        "language": "pt_BR",
        "category": "MARKETING",
        "allow_category_change": True,
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
                "text": (
                    "Olá! Falo do AxéCloud, uma plataforma desenvolvida com respeito às tradições "
                    "para apoiar terreiros na gestão da corrente, mensalidades e giras.\n\n"
                    "Entramos em contato para apresentar nossa ferramenta para {{1}}.\n\n"
                    "Posso enviar uma apresentação curta e liberar 30 dias de teste gratuito? "
                    "Para não receber mensagens, responda SAIR."
                ),
                "example": {
                    "body_text": [
                        ["Tenda de Umbanda São Sebastião"]
                    ]
                }
            },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "QUICK_REPLY",
                        "text": "Quero conhecer"
                    },
                    {
                        "type": "QUICK_REPLY",
                        "text": "Sair"
                    }
                ]
            }
        ]
    }
    
    print(f"\n2. Submetendo template '{template_name}' para WABA {waba}...")
    create_url = f"https://graph.facebook.com/{ver}/{waba}/message_templates"
    body_bytes = json.dumps(template_data, ensure_ascii=False).encode("utf-8")
    req_create = urllib.request.Request(create_url, data=body_bytes, method="POST")
    req_create.add_header("Authorization", f"Bearer {token}")
    req_create.add_header("Content-Type", "application/json; charset=utf-8")
    
    try:
        with urllib.request.urlopen(req_create) as resp:
            res_data = json.loads(resp.read().decode())
            print("Template submetido com sucesso! Resposta:", res_data)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"Erro ao criar template ({e.code}): {err_body}")
        
    # 4. Consulta status imediato
    qs = urllib.parse.urlencode({"name": template_name, "fields": "name,status,category,id,rejected_reason"})
    check_url = f"https://graph.facebook.com/{ver}/{waba}/message_templates?{qs}"
    req_check = urllib.request.Request(check_url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req_check) as resp:
            status_data = json.loads(resp.read().decode())
            print("\n3. Status do template na Meta:")
            print(json.dumps(status_data, indent=2, ensure_ascii=False))
    except Exception as e:
        print("Erro ao checar status:", e)

if __name__ == "__main__":
    main()
