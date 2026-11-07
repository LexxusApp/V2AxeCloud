#!/usr/bin/env python3
"""
Template conta_membro_aviso_zelador_axc — Utility.

Licao dos templates aprovados (aviso_portal_conta / aviso_geral / conta_ativa):
- texto = atualizacao administrativa de conta
- allow_category_change=false (Meta rejeita em vez de flip-flop)
- SEM palavras senha/codigo/CPF/6 digitos no BODY nem no example
  (isso empurra para Authentication e gera INCORRECT_CATEGORY)
- SEM botao URL
- credenciais vao so no parametro {{3}} em runtime
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV_PATH = Path(".env")

# Espelha o tom do aviso_portal_conta_axecloud (UTILITY aprovado).
TEMPLATE = {
    "name": "conta_membro_aviso_zelador_axc",
    "language": "pt_BR",
    "category": "UTILITY",
    "allow_category_change": False,
    "components": [
        {
            "type": "BODY",
            "text": (
                "Ola, {{1}}.\n\n"
                "Registramos uma atualizacao administrativa na conta de um membro do terreiro: "
                "o WhatsApp de acesso nao foi entregue.\n\n"
                "Membro: {{2}}\n\n"
                "Detalhes para repasse manual: {{3}}\n\n"
                "Esta e uma mensagem automatica do sistema AxeCloud."
            ),
            "example": {
                "body_text": [
                    [
                        "Maria Silva",
                        "Tarso Santos · WA 64981035508",
                        "Registro: AXC-2020-9CD9 · Orientacao na tela de login · Link: https://axecloud.com.br/entrar?modo=filho",
                    ]
                ]
            },
        },
    ],
}


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


def get_named(token: str, ver: str, waba: str, name: str) -> dict | None:
    qs = urllib.parse.urlencode(
        {
            "name": name,
            "fields": "id,name,status,category,language,rejected_reason,components",
        }
    )
    _, payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
    rows = payload.get("data") or []
    return rows[0] if rows else None


def delete_if_rejected(token: str, ver: str, row: dict | None) -> None:
    if not row:
        return
    status = str(row.get("status") or "")
    if status not in {"REJECTED", "PAUSED", "DISABLED", "FLAGGED"}:
        return
    tid = row.get("id")
    if not tid:
        return
    st, deleted = graph(token, ver, "DELETE", str(tid))
    print("DELETE", row.get("name"), status, st, deleted.get("success"))


def upsert_env(key: str, value: str) -> None:
    text = ENV_PATH.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    out: list[str] = []
    seen = False
    for line in lines:
        if "=" in line and line.split("=", 1)[0].strip() == key:
            out.append(f"{key}={value}")
            seen = True
        else:
            out.append(line)
    if not seen:
        out.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(out) + ("\n" if text.endswith("\n") else ""), encoding="utf-8")
    print("ENV_UPDATED", key, value)


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

    print("WABA_PREFIX=%s VER=%s" % (waba[:6], ver))

    # Limpa rejeitados anteriores desta linha
    for old in (
        "aviso_acesso_membro_falha_axc",
        "aviso_acesso_membro_falha_mkt_axc",
        "acesso_membro_nao_entregue_axc",
        "falha_acesso_membro_zelador_axecloud",
        "acesso_falhou_avisar_zelador_axecloud",
        "membro_acesso_falhou_zelador_axc",
        TEMPLATE["name"],
    ):
        delete_if_rejected(token, ver, get_named(token, ver, waba, old))

    name = TEMPLATE["name"]
    current = get_named(token, ver, waba, name)
    if current and current.get("status") in {"APPROVED", "PENDING"}:
        print("SKIP", name, current.get("status"), current.get("category"), current.get("id"))
        upsert_env("WA_META_TEMPLATE_FALHA_ACESSO_ZELADOR", name)
        return 0

    st, created = graph(token, ver, "POST", f"{waba}/message_templates", TEMPLATE)
    if created.get("error"):
        err = created.get("error") or {}
        print(
            "ERROR",
            st,
            err.get("message"),
            err.get("error_user_title"),
            err.get("error_user_msg"),
        )
        return 1
    print(
        "CREATED",
        name,
        created.get("status") or "submitted",
        created.get("category") or TEMPLATE["category"],
        created.get("id") or "",
    )

    # Poll ate ~3 min (aprovacao Utility costuma ser rapida)
    final = None
    for i in range(18):
        time.sleep(10)
        row = get_named(token, ver, waba, name)
        if not row:
            print("POLL", i + 1, "missing")
            continue
        status = row.get("status")
        print(
            "POLL",
            i + 1,
            status,
            row.get("category"),
            row.get("rejected_reason") or "",
        )
        if status in {"APPROVED", "REJECTED", "PAUSED", "DISABLED"}:
            final = row
            break

    if not final:
        final = get_named(token, ver, waba, name)

    status = (final or {}).get("status") or created.get("status") or ""
    if status in {"APPROVED", "PENDING"}:
        upsert_env("WA_META_TEMPLATE_FALHA_ACESSO_ZELADOR", name)
        print("USE_TEMPLATE", name, status)
        return 0

    print("FAILED", status, (final or {}).get("rejected_reason"))
    return 1


if __name__ == "__main__":
    sys.exit(main())
