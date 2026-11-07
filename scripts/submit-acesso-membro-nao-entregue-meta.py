#!/usr/bin/env python3
"""
Template CORRETO para avisar o zelador quando o WhatsApp de acesso do membro falha.
Layout em linhas (como o de ops), texto sobre falha de acesso — NÃO sobre novo terreiro.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"
FOOTER = "Mensagem automática. Não responda."

# Espelha a estrutura aprovada do ops (labels fixos + 3 vars), com copy correta.
TEMPLATE = {
    "name": "acesso_membro_nao_entregue_axc",
    "language": "pt_BR",
    "category": "UTILITY",
    "allow_category_change": True,
    "components": [
        {
            "type": "BODY",
            "text": (
                "Ola, {{1}}!\n\n"
                "Nao foi possivel entregar o WhatsApp de acesso ao membro.\n\n"
                "Membro: {{2}}\n\n"
                "Dados para passar manualmente:\n"
                "{{3}}\n\n"
                "Passe esses dados para ele entrar no AxeCloud. Use o botao abaixo para o link."
            ),
            "example": {
                "body_text": [
                    [
                        "Maria Silva",
                        "Tarso Santos · WA 64981035508",
                        "Registro: AXC-2020-9CD9 · Senha (6 digitos do CPF): 420900",
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
                    "text": "Entrar no app",
                    "url": "https://axecloud.com.br/entrar?modo=filho",
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


def err_text(payload: dict) -> str:
    err = payload.get("error") or {}
    parts = [
        str(err.get("message") or ""),
        str(err.get("error_user_title") or ""),
        str(err.get("error_user_msg") or ""),
    ]
    return " | ".join(p for p in parts if p)[:500]


def get_named(token: str, ver: str, waba: str, name: str) -> dict | None:
    qs = urllib.parse.urlencode(
        {"name": name, "fields": "id,name,status,category,language,rejected_reason"}
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
    print("NAME=%s" % name)
    current = get_named(token, ver, waba, name)
    if current and current.get("status") in {"APPROVED", "PENDING"}:
        print("SKIP", current.get("status"), current.get("id"))
    else:
        if current and current.get("status") in {"REJECTED", "PAUSED", "DISABLED", "FLAGGED"}:
            tid = current.get("id")
            if tid:
                st, deleted = graph(token, ver, "DELETE", str(tid))
                print("DELETE http=%s" % st, deleted.get("success"))
        st, created = graph(token, ver, "POST", f"{waba}/message_templates", TEMPLATE)
        if created.get("error"):
            print("ERROR", st, err_text(created))
            return 1
        print("CREATED", created.get("status"), created.get("id"))

    row = get_named(token, ver, waba, name)
    print(
        "%s %s %s %s"
        % (
            row.get("status") if row else "?",
            row.get("category") if row else "?",
            name,
            (row or {}).get("rejected_reason") or "",
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
