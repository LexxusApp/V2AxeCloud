#!/usr/bin/env python3
"""Cria na Meta o template aviso_estabilidade_axecloud (UTILITY)."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"
FOOTER = "Mensagem automatica — nao responda."

TEMPLATE = {
    "name": "aviso_estabilidade_axecloud",
    "language": "pt_BR",
    "category": "UTILITY",
    "allow_category_change": True,
    "components": [
        {
            "type": "BODY",
            "text": (
                "Ola, {{1}}!\n\n"
                "Informamos que a instabilidade temporaria registrada hoje no sistema AxeCloud ja foi totalmente corrigida pela nossa equipe tecnica.\n\n"
                "Todos os acessos ao painel, servicos e rotinas do terreiro estao operando normalmente.\n\n"
                "Agradecemos pela compreensao e paciencia. Qualquer duvida, estamos a disposicao. Muito axe!\n\n"
                "— Equipe AxeCloud"
            ),
            "example": {
                "body_text": [
                    [
                        "Zelador"
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

    name = TEMPLATE["name"]
    print(f"Submetendo template '{name}' (UTILITY) para WABA {waba}...")
    code, payload = graph(token, ver, "POST", f"{waba}/message_templates", TEMPLATE)
    print("RESPOSTA:", code, payload)

    # Consulta o status imediatamente
    qs = urllib.parse.urlencode({"name": name, "fields": "name,status,category,id,rejected_reason"})
    code, status_payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
    print("STATUS ATUAL:", status_payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
