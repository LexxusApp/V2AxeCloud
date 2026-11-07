#!/usr/bin/env python3
"""Edita teste_encerrando_zelador_axecloud: tira 'encerra' fixo e deixa o verbo em {{4}}."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_PATH = Path(".env")
NAME = "teste_encerrando_zelador_axecloud"
FOOTER = "Mensagem automática. Não responda."
BODY = (
    "Ola, {{1}}. O periodo de teste gratuito do painel do {{2}} {{4}}, no dia {{3}}. "
    "Seus dados cadastrados serao preservados. Acesse o AxéCloud em Assinatura para escolher como continuar."
)


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    with path.open(encoding="utf-8", errors="ignore") as fh:
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
    token = env.get("WA_META_TOKEN") or ""
    waba = env.get("WA_BUSINESS_ACCOUNT_ID") or ""
    ver = env.get("WA_BUSINESS_VERSION") or "v21.0"
    if not token or not waba:
        print("Missing WA_META_TOKEN or WA_BUSINESS_ACCOUNT_ID", file=sys.stderr)
        return 1

    qs = urllib.parse.urlencode(
        {"name": NAME, "fields": "id,name,status,category,language,components"}
    )
    code, payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
    rows = payload.get("data") or []
    if code >= 400 or not rows:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 1

    tpl = rows[0]
    tpl_id = tpl["id"]
    print(f"Found {NAME} id={tpl_id} status={tpl.get('status')} category={tpl.get('category')}")

    edit_payload = {
        "components": [
            {
                "type": "BODY",
                "text": BODY,
                "example": {
                    "body_text": [
                        [
                            "Alex",
                            "YLE EXU TIRIRI LONAN",
                            "01/09/2026",
                            "encerra amanha",
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
                        "text": "Abrir painel",
                        "url": "https://axecloud.com.br/entrar",
                    }
                ],
            },
        ]
    }

    code2, res = graph(token, ver, "POST", tpl_id, edit_payload)
    print(json.dumps({"http": code2, "response": res}, ensure_ascii=False, indent=2))
    if code2 >= 400 and not res.get("success") and not res.get("id"):
        return 1

    code3, after = graph(
        token,
        ver,
        "GET",
        f"{waba}/message_templates?{urllib.parse.urlencode({'name': NAME, 'fields': 'id,name,status,category,components'})}",
    )
    row = (after.get("data") or [None])[0]
    if row:
        body = next(
            (c.get("text") for c in (row.get("components") or []) if c.get("type") == "BODY"),
            "",
        )
        print(f"AFTER status={row.get('status')} body={body}")
    return 0 if code3 < 400 else 1


if __name__ == "__main__":
    raise SystemExit(main())
