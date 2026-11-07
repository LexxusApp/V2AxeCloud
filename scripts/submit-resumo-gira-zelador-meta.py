#!/usr/bin/env python3
"""Cria na Meta o template resumo_gira_zelador_axecloud (Utility)."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = "C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env"
FOOTER = "Mensagem automatica — nao responda."

TEMPLATE = {
    "name": "resumo_gira_zelador_axecloud",
    "language": "pt_BR",
    "category": "UTILITY",
    "allow_category_change": False,
    "components": [
        {
            "type": "BODY",
            "text": (
                "Ola, {{1}}! O aviso da gira {{2}} foi enviado.\n\n"
                "{{3}}\n\n"
                "Atualize os cadastros no painel para que todos recebam os avisos."
            ),
            "example": {
                "body_text": [
                    [
                        "Pai Franklin",
                        "Homenagem a Oxum",
                        "✅ 24 mediuns receberam com sucesso.\n⚠️ 3 numeros falharam (sem WhatsApp ou numero incorreto):\n• Oga Juniel (82 99981-1036)\n• Kely D' Oxum (35 99145-9837)\n• Brenda D'Osun (35 99153-1203)",
                    ]
                ]
            },
        },
        {"type": "FOOTER", "text": FOOTER},
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


def err_text(payload: dict) -> str:
    err = payload.get("error") or {}
    parts = [
        str(err.get("message") or ""),
        str(err.get("error_user_title") or ""),
        str(err.get("error_user_msg") or ""),
    ]
    extra = err.get("error_data")
    if extra:
        parts.append(json.dumps(extra, ensure_ascii=False)[:400])
    return " | ".join(p for p in parts if p)[:500]


def get_named(token: str, ver: str, waba: str, name: str) -> dict | None:
    qs = urllib.parse.urlencode(
        {
            "name": name,
            "fields": "id,name,status,category,language,rejected_reason",
        }
    )
    _, payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
    rows = payload.get("data") or []
    return rows[0] if rows else None


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

    name = TEMPLATE["name"]
    print("SUBMITTING %s..." % name)

    current = get_named(token, ver, waba, name)
    if current:
        print("EXISTS status=%s category=%s" % (current.get("status"), current.get("category")))
        if current.get("status") in {"APPROVED", "PENDING"}:
            return 0
        tid = current.get("id")
        if tid:
            graph(token, ver, "DELETE", str(tid))

    st, created = graph(token, ver, "POST", f"{waba}/message_templates", TEMPLATE)
    if created.get("error"):
        print("ERROR %s %s" % (st, err_text(created)))
        return 1
    print("CREATED status=%s id=%s category=%s" % (created.get("status"), created.get("id"), created.get("category")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
