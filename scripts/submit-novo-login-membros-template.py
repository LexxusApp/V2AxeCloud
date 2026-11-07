import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

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
waba = env.get("WA_BUSINESS_ACCOUNT_ID")

template_payload = {
    "name": "novo_login_membros_zelador_axecloud",
    "category": "MARKETING",
    "language": "pt_BR",
    "components": [
        {
            "type": "BODY",
            "text": "Olá, {{1}}! Axé!\n\nTemos uma novidade importante para facilitar o dia a dia da sua casa {{2}}:\n\nAgora os seus filhos e filhas de santo têm um novo método inteligente para entrar no AxéCloud.\n\nEles não precisam mais decorar apenas a matrícula! Agora podem acessar informando:\n\n📱 O número do WhatsApp cadastrado\n✉️ O e-mail pessoal cadastrado\n🆔 Ou o código de registro tradicional\n\nA senha continua sendo os 6 primeiros dígitos do CPF do membro.\n\nCom essa facilidade, sua corrente acessa avisos, escalas, presenças e mensalidades com autonomia, sem sobrecarregar você com dúvidas de acesso.\n\nVocê pode conferir como ficou diretamente no portal da casa:",
            "example": {
                "body_text": [
                    [
                        "Pai Mailson",
                        "Terreiro Xangô Agodô"
                    ]
                ]
            }
        },
        {
            "type": "FOOTER",
            "text": "AxéCloud · Gestão para Casas de Axé"
        },
        {
            "type": "BUTTONS",
            "buttons": [
                {
                    "type": "URL",
                    "text": "Conhecer Novo Acesso",
                    "url": "https://axecloud.com.br/entrar?modo=filho"
                }
            ]
        }
    ]
}

req = urllib.request.Request(
    f"https://graph.facebook.com/v21.0/{waba}/message_templates",
    data=json.dumps(template_payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print("✅ Template enviado com sucesso para a Meta!")
        print(json.dumps(res, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f"❌ Erro ao enviar template ({e.code}):")
    print(err_body)
except Exception as e:
    print(f"❌ Erro inesperado: {e}")
