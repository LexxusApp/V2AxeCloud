import json
import urllib.request
import urllib.error
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

token = env.get("WA_META_TOKEN")
waba = env.get("WA_BUSINESS_ACCOUNT_ID")

template_payload = {
    "name": "acesso_portal_membro_axecloud",
    "language": "pt_BR",
    "category": "UTILITY",
    "components": [
        {
            "type": "BODY",
            "text": "Olá, {{1}}! Você foi cadastrado(a) no terreiro {{2}} no AxéCloud.\n\nSeu registro de acesso é {{3}}. Sua senha são os 6 primeiros dígitos do seu CPF.\n\nToque no botão abaixo para entrar no seu portal:",
            "example": {
                "body_text": [
                    [
                        "Beatriz",
                        "yle ase Tobi omim Yna",
                        "AXC-2026-162A"
                    ]
                ]
            }
        },
        {
            "type": "FOOTER",
            "text": "AxéCloud · Gestão para Terreiros"
        },
        {
            "type": "BUTTONS",
            "buttons": [
                {
                    "type": "URL",
                    "text": "Entrar no Portal",
                    "url": "https://axecloud.com.br/entrar?modo=filho"
                }
            ]
        }
    ]
}

print("=== SUBMETENDO NOVO TEMPLATE À META (OPÇÃO 2) ===")
url = f"https://graph.facebook.com/v21.0/{waba}/message_templates"
req = urllib.request.Request(
    url,
    data=json.dumps(template_payload).encode("utf-8"),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
    print("✅ Template enviado com sucesso à Meta!")
    print(json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f"❌ Erro HTTP {e.code}: {err_body}")
except Exception as e:
    print(f"❌ Erro: {e}")
