#!/usr/bin/env python3
"""Apaga templates Meta por nome (lista fixa). Nao imprime token."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"

# Substituidos / rejeitados / lixo Meta / nunca ligados no .env de producao.
DELETE_NAMES = [
    # REJECTED
    "acesso_falhou_avisar_zelador_axecloud",
    "acesso_membro_nao_entregue_axc",
    "aviso_acesso_membro_falha_axc",
    "aviso_acesso_membro_falha_mkt_axc",
    "conta_membro_acesso_dados_axc",
    "conta_membro_acesso_dados_mkt_axc",
    "falha_acesso_membro_zelador_axecloud",
    "membro_acesso_falhou_zelador_axc",
    # Substituidos / nao usados na producao atual
    "aviso_gira_util_axecloud",  # prod = aviso_gira_lembrete_membro_axecloud
    "boas_vindas_zelador_axecloud",  # prod = boas_vindas_zelador_v2_axecloud
    "conta_ativa_axecloud",  # prod = conta_membro_cadastro_axc
    "conta_membro_ref_portal_axc",  # docs: evitar
    "guia_membro_portal_axecloud",  # sem registro — nao usar
    "aviso_portal_casa_axecloud",  # nao ligado no .env
    "aviso_portal_membro_axecloud",  # nao ligado no .env
    "hello_world",  # template padrao Meta
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
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
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


def list_all(token: str, ver: str, waba: str) -> list[dict]:
    rows: list[dict] = []
    after = None
    while True:
        qs: dict[str, str] = {
            "fields": "name,status,category,id",
            "limit": "100",
        }
        if after:
            qs["after"] = after
        code, payload = graph(token, ver, "GET", f"{waba}/message_templates?{urllib.parse.urlencode(qs)}")
        if code >= 400:
            raise RuntimeError(json.dumps(payload)[:400])
        rows.extend(payload.get("data") or [])
        paging = (payload.get("paging") or {}).get("cursors") or {}
        after = paging.get("after")
        if not after or not (payload.get("paging") or {}).get("next"):
            break
    return rows


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

    dry = "--dry-run" in sys.argv
    rows = list_all(token, ver, waba)
    by_name = {str(r.get("name")): r for r in rows}

    deleted = 0
    missing = 0
    failed = 0
    for name in DELETE_NAMES:
        row = by_name.get(name)
        if not row:
            print(f"MISS\t{name}")
            missing += 1
            continue
        tid = str(row.get("id") or "")
        status = row.get("status")
        cat = row.get("category")
        if dry:
            print(f"DRY\t{status}\t{cat}\t{name}\tid={tid}")
            continue
        # Meta exige DELETE no edge do WABA com name= (nao DELETE no id do HSM).
        qs = urllib.parse.urlencode({"name": name})
        code, payload = graph(token, ver, "DELETE", f"{waba}/message_templates?{qs}")
        ok = code < 400 and bool(payload.get("success"))
        if ok:
            print(f"DEL_OK\t{name}\tid={tid}")
            deleted += 1
        else:
            print(f"DEL_FAIL\t{name}\thttp={code}\t{json.dumps(payload, ensure_ascii=False)[:240]}")
            failed += 1

    print(f"SUMMARY deleted={deleted} missing={missing} failed={failed} dry={dry}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
