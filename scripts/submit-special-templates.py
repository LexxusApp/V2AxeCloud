#!/usr/bin/env python3
"""Cria na Meta os templates acesso_restabelecido_axecloud e cortesia_30dias_axecloud (UTILITY)."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"
FOOTER = "Mensagem automatica — nao responda."

TEMPLATES = [
    {
        "name": "acesso_restabelecido_axecloud",
        "language": "pt_BR",
        "category": "UTILITY",
        "allow_category_change": True,
        "components": [
            {
                "type": "BODY",
                "text": (
                    "Ola, {{1}}!\n\n"
                    "Confirmamos o seu pagamento e informamos que o acesso ao painel do terreiro {{2}} foi totalmente restabelecido com sucesso.\n\n"
                    "Sua assinatura esta ativa e com todos os recursos operando normalmente ate {{3}}.\n\n"
                    "Muito axe para sua casa e sua corrente!\n\n"
                    "— Equipe AxeCloud"
                ),
                "example": {
                    "body_text": [
                        [
                            "Zelador",
                            "Terreiro de Umbanda",
                            "13/11/2026"
                        ]
                    ]
                },
            },
            {"type": "FOOTER", "text": FOOTER},
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "URL",
                        "text": "Acessar painel",
                        "url": "https://axecloud.com.br/login",
                    }
                ],
            },
        ],
    },
    {
        "name": "cortesia_30dias_axecloud",
        "language": "pt_BR",
        "category": "UTILITY",
        "allow_category_change": True,
        "components": [
            {
                "type": "BODY",
                "text": (
                    "Ola, {{1}}!\n\n"
                    "Para garantir que o terreiro {{2}} continue suas atividades sem nenhuma interrupcao apos a instabilidade de hoje, liberamos +30 dias de acesso 100% gratuito ao AxeCloud na sua conta.\n\n"
                    "Seu painel ja esta liberado e totalmente ativo ate {{3}}.\n\n"
                    "Agradecemos pela sua confianca e parceria. Muito axe!\n\n"
                    "— Equipe AxeCloud"
                ),
                "example": {
                    "body_text": [
                        [
                            "Zelador",
                            "Terreiro de Umbanda",
                            "13/11/2026"
                        ]
                    ]
                },
            },
            {"type": "FOOTER", "text": FOOTER},
            {
                "type": "BUTTONS",
                "buttons": [
                    {
                        "type": "URL",
                        "text": "Acessar painel",
                        "url": "https://axecloud.com.br/login",
                    }
                ],
            },
        ],
    }
]


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


def graph(token: str, ver: str, method: str, path: str, body=None):
    url = f"https://graph.facebook.com/{ver}/{path}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if body is not None:
        req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="ignore")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"error": {"message": raw[:400]}}
        return exc.code, parsed


def main() -> int:
    env = load_env(ENV_PATH)
    token = (env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or "").strip()
    waba = (
        env.get("WA_BUSINESS_ACCOUNT_ID")
        or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
        or env.get("WA_WABA_ID")
        or ""
    ).strip()
    ver = (env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0").strip()
    if not token or not waba:
        print("MISSING_CREDS")
        return 1

    for t in TEMPLATES:
        name = t["name"]
        print(f"\nSubmetendo template '{name}' (UTILITY)...")
        code, payload = graph(token, ver, "POST", f"{waba}/message_templates", t)
        print("RESPOSTA:", code, payload)

        qs = urllib.parse.urlencode({"name": name, "fields": "name,status,category,id,rejected_reason"})
        code, status_payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
        print("STATUS ATUAL:", status_payload)

    return 0


if __name__ == "__main__":
    sys.exit(main())
