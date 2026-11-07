#!/usr/bin/env python3
"""Explain shared IP: zelador vs filho logins for Templo Macaia."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"
IP = "168.181.133.228"
PREFIX = "5e0f1908"


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
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_KEY")
    assert url and key

    filhos = sb(
        url,
        key,
        "filhos_de_santo",
        {
            "select": "id,nome,whatsapp_phone,status,user_id",
            "tenant_id": f"eq.{TENANT}",
            "order": "created_at.asc",
        },
    )
    print("FILHOS")
    for r in filhos:
        uid = str(r.get("user_id") or "")
        fid = str(r.get("id") or "")
        mark = ""
        if uid.startswith(PREFIX) or fid.startswith(PREFIX):
            mark = " <== MATCH_PREFIX"
        print(
            json.dumps(
                {
                    "nome": r.get("nome"),
                    "id8": fid[:8],
                    "user8": uid[:8] if uid else None,
                    "wa": r.get("whatsapp_phone"),
                },
                ensure_ascii=False,
            )
            + mark
        )

    logs = sb(
        url,
        key,
        "audit_logs",
        {
            "select": "created_at,action,status,details,user_id,user_email,ip",
            "ip": f"eq.{IP}",
            "order": "created_at.desc",
            "limit": "20",
        },
    )
    print("AUDIT")
    for L in logs:
        d = L.get("details") or {}
        print(
            json.dumps(
                {
                    "at": L.get("created_at"),
                    "action": L.get("action"),
                    "status": L.get("status"),
                    "email": L.get("user_email"),
                    "uid8": (str(L.get("user_id"))[:8] if L.get("user_id") else None),
                    "mode": d.get("mode"),
                    "filho8": (str(d.get("filhoId"))[:8] if d.get("filhoId") else None),
                    "nome": d.get("nome"),
                },
                ensure_ascii=False,
            )
        )


if __name__ == "__main__":
    main()
