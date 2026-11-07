#!/usr/bin/env python3
"""Check preview delivery + zelador welcome for new terreiro."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"
PREVIEW_PHONE = "5511920033501"
SINCE = "2026-09-05T00:00:00+00:00"


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

    # Preview messages to Lucas
    preview = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,external_id,mensagem",
            "or": f"(telefone.eq.{PREVIEW_PHONE},telefone.eq.11920033501,telefone.ilike.*920033501*)",
            "order": "created_at.desc",
            "limit": "15",
        },
    )
    print("=== PREVIEW_TO_LUCAS ===")
    print(json.dumps(preview, ensure_ascii=False, indent=2)[:5000])

    # Any recent logs mentioning PREVIA / falha acesso
    recent_previa = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,external_id,mensagem,tenant_id",
            "mensagem": "ilike.*PREVIA*",
            "order": "created_at.desc",
            "limit": "10",
        },
    )
    print("=== LOGS_COM_PREVIA ===")
    print(json.dumps(recent_previa, ensure_ascii=False, indent=2)[:4000])

    # Welcome / boas_vindas for the new tenant
    welcome = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,external_id,mensagem,tenant_id",
            "tenant_id": f"eq.{TENANT}",
            "created_at": f"gte.{SINCE}",
            "order": "created_at.asc",
            "limit": "40",
        },
    )
    print("=== TENANT_WA_SINCE_SEP5 ===")
    for row in welcome:
        print(
            json.dumps(
                {
                    "at": row.get("created_at"),
                    "tipo": row.get("tipo"),
                    "status": row.get("status"),
                    "tel": row.get("telefone"),
                    "ext": str(row.get("external_id") or "")[:48],
                    "msg": str(row.get("mensagem") or "")[:160],
                },
                ensure_ascii=False,
            )
        )

    # Also search boas_vindas by tipo globally since sep5 (in case tenant_id differs)
    boas = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,external_id,mensagem,tenant_id",
            "tipo": "ilike.*boas*",
            "created_at": f"gte.{SINCE}",
            "order": "created_at.desc",
            "limit": "20",
        },
    )
    print("=== BOAS_VINDAS_TIPOS ===")
    print(json.dumps(boas, ensure_ascii=False, indent=2)[:5000])

    # audit register for tenant
    try:
        audits = sb(
            url,
            key,
            "audit_logs",
            {
                "select": "created_at,action,status,user_email,details,terreiro_id",
                "or": f"(terreiro_id.eq.{TENANT},user_email.eq.jesuemallvm@gmail.com)",
                "created_at": f"gte.{SINCE}",
                "order": "created_at.asc",
                "limit": "30",
            },
        )
        print("=== AUDIT_TERREIRO ===")
        for a in audits:
            print(
                json.dumps(
                    {
                        "at": a.get("created_at"),
                        "action": a.get("action"),
                        "status": a.get("status"),
                        "email": a.get("user_email"),
                    },
                    ensure_ascii=False,
                )
            )
    except Exception as e:
        print("AUDIT_ERR", e)


if __name__ == "__main__":
    main()
