#!/usr/bin/env python3
"""
conta_membro_cadastro_axc — Utility amigavel para membro novo.
Texto no tom do conta_ativa (aprovado); credenciais so no {{3}} em runtime.
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

TEMPLATE = {
    "name": "conta_membro_cadastro_axc",
    "language": "pt_BR",
    "category": "UTILITY",
    "allow_category_change": False,
    "components": [
        {
            "type": "BODY",
            "text": (
                "Ola, {{1}}!\n\n"
                "Voce foi cadastrado(a) no AxeCloud do terreiro {{2}}.\n\n"
                "{{3}}\n\n"
                "Use esses dados para entrar no portal. Axé!"
            ),
            "example": {
                "body_text": [
                    [
                        "Maria Silva",
                        "Terreiro de Oxum",
                        "Registro: AXC-2026-A1B2 · Link: https://axecloud.com.br/entrar?modo=filho",
                    ]
                ]
            },
        },
    ],
}

# Fallback Marketing se Utility rejeitar (guia_membro ja passou como MKT).
TEMPLATE_MKT = {
    **TEMPLATE,
    "name": "conta_membro_cadastro_mkt_axc",
    "category": "MARKETING",
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
        {"name": name, "fields": "id,name,status,category,language,rejected_reason"}
    )
    _, payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
    rows = payload.get("data") or []
    return rows[0] if rows else None


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


def submit(token: str, ver: str, waba: str, template: dict) -> tuple[str, dict | None]:
    name = template["name"]
    current = get_named(token, ver, waba, name)
    if current and current.get("status") in {"REJECTED", "PAUSED", "DISABLED", "FLAGGED"} and current.get("id"):
        st, deleted = graph(token, ver, "DELETE", str(current["id"]))
        print("DELETE", name, st, deleted.get("success"))
    current = get_named(token, ver, waba, name)
    if current and current.get("status") in {"APPROVED", "PENDING"}:
        print("SKIP", name, current.get("status"), current.get("category"))
        return str(current.get("status")), current

    st, created = graph(token, ver, "POST", f"{waba}/message_templates", template)
    if created.get("error"):
        err = created.get("error") or {}
        print("ERROR", name, st, err.get("message"), err.get("error_user_title"))
        return "ERROR", None
    print("CREATED", name, created.get("status"), created.get("category"), created.get("id"))

    final = None
    for i in range(24):
        time.sleep(10)
        row = get_named(token, ver, waba, name)
        if not row:
            print("POLL", name, i + 1, "missing")
            continue
        print("POLL", name, i + 1, row.get("status"), row.get("category"), row.get("rejected_reason") or "")
        if row.get("status") in {"APPROVED", "REJECTED", "PAUSED", "DISABLED"}:
            final = row
            break
    if not final:
        final = get_named(token, ver, waba, name)
    return str((final or {}).get("status") or created.get("status") or ""), final


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

    # Enquanto o novo nao aprova: volta o template claro antigo (sem o texto administrativo).
    upsert_env("WA_META_TEMPLATE_DADOS_ACESSO", "acesso_membro_guia_axecloud")

    status, row = submit(token, ver, waba, TEMPLATE)
    chosen = TEMPLATE["name"]
    if status == "REJECTED":
        print("FALLBACK_MARKETING")
        status, row = submit(token, ver, waba, TEMPLATE_MKT)
        chosen = TEMPLATE_MKT["name"]

    if status == "APPROVED":
        upsert_env("WA_META_TEMPLATE_DADOS_ACESSO", chosen)
        print("USE_TEMPLATE", chosen, status)
        return 0
    if status == "PENDING":
        print("STILL_PENDING", chosen, "(producao voltou para acesso_membro_guia_axecloud)")
        return 0
    print("FAILED", chosen, status, (row or {}).get("rejected_reason"))
    return 1


if __name__ == "__main__":
    sys.exit(main())
