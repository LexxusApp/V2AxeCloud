#!/usr/bin/env python3
"""Check latest dados_acesso status for Tarso after resend."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"
FILHO = "9cd90cb3-7869-49b2-9e27-bd13ac33178f"
WAMID = "wamid.HBgMNTU2NDgxMDM1NTA4FQIAERgSMTgxMjBBRTJDMjM0MTQ2QTI4AA=="


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
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    env = load_env(Path(".env"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = (
        env.get("SUPABASE_SERVICE_ROLE_KEY")
        or env.get("SUPABASE_SERVICE_KEY")
        or env.get("SERVICE_ROLE_KEY")
    )
    assert url and key

    logs = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,filho_id,telefone,status,created_at,external_id,mensagem",
            "tenant_id": f"eq.{TENANT}",
            "filho_id": f"eq.{FILHO}",
            "tipo": "eq.dados_acesso",
            "order": "created_at.desc",
            "limit": "5",
        },
    )
    print(json.dumps(logs, ensure_ascii=False, indent=2)[:5000])
    print("TARGET_WAMID", WAMID)


if __name__ == "__main__":
    main()
