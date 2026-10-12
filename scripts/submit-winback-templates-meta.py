#!/usr/bin/env python3
"""Submete os templates de resgate de terreiros (Win-Back) com botões à Meta."""
import json
import urllib.request
import urllib.error

ENV_PATH = ".env"

def load_env(path: str) -> dict[str, str]:
    env = {}
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env

env = load_env(ENV_PATH)
token = env.get("WA_META_TOKEN") or env.get("META_CLOUD_TOKEN") or env.get("WHATSAPP_TOKEN")
waba_id = env.get("WA_BUSINESS_ACCOUNT_ID") or env.get("META_WABA_ID")

if not token or not waba_id:
    print(f"Erro: credenciais ausentes token={bool(token)} waba_id={bool(waba_id)}")
    exit(1)

templates = [
    {
        "name": "resgate_com_filhos_axecloud",
        "language": "pt_BR",
        "category": "MARKETING",
        "allow_category_change": True,
        "components": [
            {
                "type": "BODY",
                "text": (
                    "Olá, {{1}}! Axé! 🙏\n\n"
                    "As fichas dos filhos de santo e as giras do terreiro {{2}} continuam salvas com total segurança no AxéCloud.\n\n"
                    "Sabemos como a rotina litúrgica é intensa. Para você retomar a organização da sua casa sem burocracia, liberamos uma condição especial exclusiva.\n\n"
                    "Clique abaixo na opção que você deseja para reativar seu terreiro:"
                ),
                "example": {
                    "body_text": [
                        [
                            "Pai Jesuema",
                            "Templo Reino da Macaia"
                        ]
                    ]
                }
            },
            {
                "type": "FOOTER",
                "text": "Escolha uma opção abaixo:"
            },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "QUICK_REPLY",
                        "text": "50% de Desconto"
                    },
                    {
                        "type": "QUICK_REPLY",
                        "text": "15 Dias + 50%"
                    }
                ]
            }
        ]
    },
    {
        "name": "resgate_sem_filhos_axecloud",
        "language": "pt_BR",
        "category": "MARKETING",
        "allow_category_change": True,
        "components": [
            {
                "type": "BODY",
                "text": (
                    "Olá, {{1}}! Axé! 🌿\n\n"
                    "Notamos que o período de teste do terreiro {{2}} encerrou na correria das obrigações da casa.\n\n"
                    "Queremos que você experimente a tranquilidade de ter a casa organizada no AxéCloud.\n\n"
                    "Clique abaixo na opção que você deseja para ativar mais tempo:"
                ),
                "example": {
                    "body_text": [
                        [
                            "Mailson",
                            "Terreiro Xangô Agodô"
                        ]
                    ]
                }
            },
            {
                "type": "FOOTER",
                "text": "Escolha uma opção abaixo:"
            },
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "QUICK_REPLY",
                        "text": "+ 15 Dias"
                    }
                ]
            }
        ]
    }
]

for t in templates:
    url = f"https://graph.facebook.com/v21.0/{waba_id}/message_templates"
    data = json.dumps(t, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    
    print(f"Submetendo template: {t['name']}...")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            res_body = json.loads(res.read().decode("utf-8"))
            print(f"Sucesso! Status={res.status}, Resposta={res_body}")
    except urllib.error.HTTPError as exc:
        raw_err = exc.read().decode("utf-8", errors="ignore")
        print(f"Erro {exc.code} ao submeter {t['name']}: {raw_err}")
