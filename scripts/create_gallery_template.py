import urllib.request
import json
import os

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
waba_id = env.get("WA_BUSINESS_ACCOUNT_ID")
phone_id = env.get("WA_PHONE_NUMBER_ID")
ver = "v21.0"

# 1. Get App ID from debug_token
debug_url = f"https://graph.facebook.com/{ver}/debug_token?input_token={token}&access_token={token}"
req = urllib.request.Request(debug_url)
with urllib.request.urlopen(req) as resp:
    debug_data = json.loads(resp.read().decode("utf-8"))
    app_id = debug_data["data"]["app_id"]
    print(f"1. Meta App ID identificado: {app_id}")

# 2. Upload file via Resumable Upload API to get header_handle
image_path = "public/banner-galeria-100gb.jpg"
with open(image_path, "rb") as f:
    image_bytes = f.read()

file_len = len(image_bytes)
print(f"2. Iniciando upload da imagem ({file_len} bytes)...")

# Step 2a: Create upload session
create_upload_url = f"https://graph.facebook.com/{ver}/{app_id}/uploads?file_length={file_len}&file_type=image/jpeg&access_token={token}"
req_session = urllib.request.Request(create_upload_url, method="POST")
with urllib.request.urlopen(req_session) as resp:
    session_data = json.loads(resp.read().decode("utf-8"))
    upload_session_id = session_data["id"]
    print(f"   -> Sessão criada: {upload_session_id}")

# Step 2b: Upload bytes
upload_bytes_url = f"https://graph.facebook.com/{ver}/{upload_session_id}"
req_bytes = urllib.request.Request(
    upload_bytes_url,
    data=image_bytes,
    headers={
        "Authorization": f"OAuth {token}",
        "file_offset": "0",
        "Content-Type": "application/octet-stream"
    },
    method="POST"
)
with urllib.request.urlopen(req_bytes) as resp:
    upload_res = json.loads(resp.read().decode("utf-8"))
    header_handle = upload_res["h"]
    print(f"   -> Upload concluído! header_handle: {header_handle[:25]}...")

# 3. Construct template definition
template_payload = {
    "name": "galeria_memoria_100gb_axecloud",
    "language": "pt_BR",
    "category": "MARKETING",
    "allow_category_change": True,
    "components": [
        {
            "type": "HEADER",
            "format": "IMAGE",
            "example": {
                "header_handle": [header_handle]
            }
        },
        {
            "type": "BODY",
            "text": (
                "Olá, {{1}}! Axé. 🙏\n\n"
                "Você sabia que o {{2}} tem 100 GB de armazenamento exclusivo no AxéCloud para guardar as fotos e vídeos da casa?\n\n"
                "🌿 *Guarde a memória do seu terreiro com segurança:*\n"
                "• Álbuns organizados por gira, festa ou tema;\n"
                "• Fotos e vídeos salvos em alta qualidade;\n"
                "• Liberte espaço na memória do seu celular e nunca mais perca registros do sagrado em grupos de WhatsApp.\n\n"
                "Acesse seu painel e experimente criar o primeiro álbum da casa hoje mesmo!"
            ),
            "example": {
                "body_text": [
                    [
                        "Pai Cristian",
                        "Terreiro de Umbanda Cabocla Urandi"
                    ]
                ]
            }
        },
        {
            "type": "FOOTER",
            "text": "AxéCloud · Tecnologia a serviço do sagrado"
        },
        {
            "type": "BUTTONS",
            "buttons": [
                {
                    "type": "URL",
                    "text": "Entrar no AxéCloud",
                    "url": "https://axecloud.com.br/entrar"
                }
            ]
        }
    ]
}

# 4. Check if template already exists
check_url = f"https://graph.facebook.com/{ver}/{waba_id}/message_templates?name=galeria_memoria_100gb_axecloud"
req_check = urllib.request.Request(check_url, headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(req_check) as resp:
    existing = json.loads(resp.read().decode("utf-8")).get("data", [])

if existing:
    print(f"3. Template já existe. Status atual: {existing[0].get('status')}. Atualizando/Recriando se necessário...")
    # If rejected or pending, print info
    print(json.dumps(existing[0], indent=2))
else:
    print("3. Submetendo novo template à Meta Cloud API...")
    create_url = f"https://graph.facebook.com/{ver}/{waba_id}/message_templates"
    req_create = urllib.request.Request(
        create_url,
        data=json.dumps(template_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req_create) as resp:
            created_data = json.loads(resp.read().decode("utf-8"))
            print(">>> SUCESSO! Template submetido à Meta! <<<")
            print("Resposta:", json.dumps(created_data, indent=2))
    except urllib.error.HTTPError as e:
        print(f"Erro na submissão ({e.code}):", e.read().decode("utf-8"))

# 5. Fetch updated status
with urllib.request.urlopen(req_check) as resp:
    latest = json.loads(resp.read().decode("utf-8")).get("data", [])
    if latest:
        print("\n>>> STATUS DO TEMPLATE NA META: <<<")
        print(f"Nome: {latest[0].get('name')}")
        print(f"Status: {latest[0].get('status')}")
        print(f"Categoria: {latest[0].get('category')}")
        print(f"ID: {latest[0].get('id')}")
