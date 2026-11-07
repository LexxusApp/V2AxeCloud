#!/usr/bin/env python3
"""Submete o template oficial mensalidade_vencida_axecloud na Meta Cloud API."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"

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

def main() -> int:
    env = load_env(ENV_PATH)
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    waba = (
        env.get("WA_BUSINESS_ACCOUNT_ID")
        or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
        or env.get("WA_WABA_ID")
        or ""
    )
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"
    if not token or not waba:
        print("MISSING_CREDS")
        return 1

    template_payload = {
        "name": "mensalidade_vencida_axecloud",
        "language": "pt_BR",
        "category": "UTILITY",
        "allow_category_change": False,
        "components": [
            {
                "type": "BODY",
                "text": (
                    "Olá, {{1}}! Passando para lembrar que a sua mensalidade de {{2}} no valor de R$ {{3}} "
                    "do {{4}} venceu em {{5}} e consta em aberto.\n\n"
                    "Caso já tenha regularizado, por favor entre em contato com o zelador para dar baixa. Axé!"
                ),
                "example": {
                    "body_text": [
                        [
                            "Mariana Silva",
                            "outubro de 2026",
                            "150,00",
                            "Templo Reino da Macaia",
                            "10/10/2026"
                        ]
                    ]
                }
            },
            {
                "type": "FOOTER",
                "text": "Mensagem automática. Não responda."
            }
        ]
    }

    url = f"https://graph.facebook.com/{ver}/{waba}/message_templates"
    data = json.dumps(template_payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            res_data = json.loads(res.read().decode())
            print("SUCCESS:", json.dumps(res_data, indent=2, ensure_ascii=False))
            return 0
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="ignore")
        print(f"HTTP ERROR {exc.code}:", raw)
        return 1

if __name__ == "__main__":
    sys.exit(main())
