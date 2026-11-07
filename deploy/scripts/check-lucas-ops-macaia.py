#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlencode


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get(url: str, key: str, table: str, params: dict[str, str]):
    q = urlencode(params, safe="(),.*:")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{table}?{q}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"HTTP {e.code} {table}: {body[:400]}") from e


def main() -> None:
    env = load_env(Path(".env"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_KEY")
    assert url and key

    lucas = get(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "created_at,tipo,status,telefone,mensagem",
            "telefone": "ilike.*920033501*",
            "created_at": "gte.2026-09-05T00:00:00Z",
            "order": "created_at.desc",
            "limit": "25",
        },
    )
    print("LUCAS_SINCE_SEP5", len(lucas))
    for r in lucas:
        print(r["created_at"], r["tipo"], r["status"], (r.get("mensagem") or "")[:120])

    macaia = get(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "created_at,tipo,status,telefone,mensagem",
            "mensagem": "ilike.*Macaia*",
            "order": "created_at.desc",
            "limit": "15",
        },
    )
    print("MACAIA", len(macaia))
    for r in macaia:
        print(r["created_at"], r["tipo"], r["status"], r["telefone"], (r.get("mensagem") or "")[:130])

    zel = get(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "created_at,tipo,status,telefone,mensagem",
            "telefone": "ilike.*981036902*",
            "created_at": "gte.2026-09-05T00:00:00Z",
            "order": "created_at.asc",
            "limit": "25",
        },
    )
    print("ZELADOR_WA", len(zel))
    for r in zel:
        print(r["created_at"], r["tipo"], r["status"], (r.get("mensagem") or "")[:120])

    # broader: any log mentioning Infernal / Jesue / novo terreiro near register
    for term in ("Infernal", "novo terreiro", "Jesu"):
        rows = get(
            url,
            key,
            "whatsapp_logs",
            {
                "select": "created_at,tipo,status,telefone,mensagem",
                "mensagem": f"ilike.*{term}*",
                "created_at": "gte.2026-09-05T00:00:00Z",
                "order": "created_at.desc",
                "limit": "8",
            },
        )
        print(f"TERM_{term}", len(rows))
        for r in rows:
            print(r["created_at"], r["tipo"], r["status"], r["telefone"], (r.get("mensagem") or "")[:130])


if __name__ == "__main__":
    main()
