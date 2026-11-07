#!/usr/bin/env python3
"""Lookup Tarso filho id + confirm phone before resend."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"
PHONE_HINT = "981035508"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def sb(url: str, key: str, path: str, params: dict[str, str]):
    qs = urllib.parse.urlencode(params, safe="(),.*:")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{path}?{qs}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"HTTP {e.code} {path}: {body[:800]}") from e


def main() -> None:
    env = load_env(Path(".env"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = (
        env.get("SUPABASE_SERVICE_ROLE_KEY")
        or env.get("SUPABASE_SERVICE_KEY")
        or env.get("SERVICE_ROLE_KEY")
    )
    assert url and key

    filhos = sb(
        url,
        key,
        "filhos_de_santo",
        {
            "select": "id,nome,whatsapp_phone,cpf,status,tenant_id",
            "tenant_id": f"eq.{TENANT}",
            "nome": "ilike.*Tarso*",
        },
    )
    print("BY_NOME", json.dumps(filhos, ensure_ascii=False, indent=2))

    by_phone = sb(
        url,
        key,
        "filhos_de_santo",
        {
            "select": "id,nome,whatsapp_phone,cpf,status,tenant_id",
            "tenant_id": f"eq.{TENANT}",
            "whatsapp_phone": f"ilike.*{PHONE_HINT}*",
        },
    )
    print("BY_PHONE", json.dumps(by_phone, ensure_ascii=False, indent=2))

    logs = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,filho_id,telefone,status,created_at,external_id",
            "tenant_id": f"eq.{TENANT}",
            "tipo": "eq.dados_acesso",
            "order": "created_at.desc",
            "limit": "8",
        },
    )
    print("RECENT_DADOS_ACESSO", json.dumps(logs, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
