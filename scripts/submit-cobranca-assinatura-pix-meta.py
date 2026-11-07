#!/usr/bin/env python3
"""Cria na Meta o template cobranca_assinatura_pix_axecloud (Pix Copia e Cola + botao URL)."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"
FOOTER = "Mensagem automatica — nao responda."

TEMPLATE = {
    "name": "cobranca_assinatura_pix_axecloud",
    "language": "pt_BR",
    "category": "UTILITY",
    "allow_category_change": True,
    "components": [
        {
            "type": "BODY",
            "text": (
                "Ola, {{1}}.\n\n"
                "A assinatura do terreiro {{2}} {{3}}.\n"
                "Plano Premium. Valor: {{4}}\n\n"
                "Chave Pix Copia e Cola:\n"
                "{{5}}\n\n"
                "Copie o codigo acima e pague no app do seu banco para renovar instantaneamente."
            ),
            "example": {
                "body_text": [
                    [
                        "Joyce",
                        "T.U. Casa de Oxossi Caridade e Amor",
                        "vence amanha, no dia 13/09/2026",
                        "R$ 69,90",
                        "000201265802BR5913AxeCloud6009Sao Paulo62070503***6304ABCD",
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
                    "text": "Pagar no site",
                    "url": "https://axecloud.com.br/assinatura/renovar",
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


def get_named(token: str, ver: str, waba: str, name: str) -> dict | None:
    qs = urllib.parse.urlencode(
        {
            "name": name,
            "fields": "name,status,category,language,rejected_reason",
            "limit": "5",
        }
    )
    code, payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
    if code >= 400:
        print(f"LIST_FAIL: {payload}")
        return None
    for row in payload.get("data") or []:
        if str(row.get("name") or "") == name:
            return row
    return None


def main() -> int:
    env = load_env(ENV_PATH)
    token = (env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or "").strip()
    waba = (
        env.get("WA_BUSINESS_ACCOUNT_ID")
        or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
        or env.get("WA_META_WABA_ID")
        or env.get("WA_WABA_ID")
        or ""
    ).strip()
    ver = (env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0").strip()
    if not token or not waba:
        print("MISSING_CREDS")
        return 1

    name = TEMPLATE["name"]
    print("SUBMITTING TO META:", name)

    existing = get_named(token, ver, waba, name)
    if existing:
        print(f"EXISTING: {existing.get('status')} category={existing.get('category')}")
        if existing.get("status") in {"APPROVED", "PENDING"}:
            return 0
        tid = existing.get("id")
        if tid:
            graph(token, ver, "DELETE", str(tid))

    code, payload = graph(token, ver, "POST", f"{waba}/message_templates", TEMPLATE)
    if code >= 400:
        print("CREATE_FAIL:", json.dumps(payload, indent=2, ensure_ascii=False))
        return 1

    tid = payload.get("id") or "?"
    status = payload.get("status") or "?"
    print(f"CREATED: {name} id={tid} status={status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
