#!/usr/bin/env python3
"""Deep check: preview wamid status + zelador welcome path for Macaia."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"
WAMID_ORGANIZED = "wamid.HBgNNTUxMTkyMDAzMzUwMRUCABEYEjc5QzMyQ0MzOUY0RTIzQTY5RAA="
WAMID_PREVIA1 = "wamid.HBgNNTUxMTkyMDAzMzUwMRUCABEYEkJGMjkxQzhGRjdCMDYyNDBGOQA="


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


def auth_user(url: str, key: str, user_id: str):
    req = urllib.request.Request(
        f"{url.rstrip('/')}/auth/v1/admin/users/{user_id}",
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

    for label, wid in [("ORGANIZED", WAMID_ORGANIZED), ("PREVIA1", WAMID_PREVIA1)]:
        rows = sb(
            url,
            key,
            "whatsapp_logs",
            {
                "select": "id,tipo,telefone,status,created_at,mensagem",
                "external_id": f"eq.{wid}",
            },
        )
        print(f"LOG_{label}", json.dumps(rows, ensure_ascii=False)[:800])

    # admin inbox if exists
    try:
        inbox = sb(
            url,
            key,
            "admin_whatsapp_messages",
            {
                "select": "id,direction,status,phone_e164,created_at,body,external_id",
                "or": f"(external_id.eq.{WAMID_ORGANIZED},external_id.eq.{WAMID_PREVIA1},phone_e164.ilike.*920033501*)",
                "order": "created_at.desc",
                "limit": "10",
            },
        )
        print("INBOX", json.dumps(inbox, ensure_ascii=False, indent=2)[:3000])
    except Exception as e:
        print("INBOX_ERR", getattr(e, "code", e))

    user = auth_user(url, key, TENANT)
    meta = user.get("user_metadata") or {}
    print(
        "ZELADOR",
        json.dumps(
            {
                "email": user.get("email"),
                "phone_meta": meta.get("whatsapp") or meta.get("phone"),
                "nome": meta.get("nome_zelador") or meta.get("name"),
                "terreiro": meta.get("nome_terreiro") or meta.get("terreiro"),
                "created": user.get("created_at"),
            },
            ensure_ascii=False,
        ),
    )

    # Any WA to zelador phone since register
    zphone = str(meta.get("whatsapp") or "").replace(r"\D", "")
    digits = "".join(c for c in str(meta.get("whatsapp") or "") if c.isdigit())
    print("ZELADOR_PHONE_DIGITS", digits)
    if digits:
        tail = digits[-8:]
        to_zelador = sb(
            url,
            key,
            "whatsapp_logs",
            {
                "select": "id,tipo,telefone,status,created_at,mensagem,external_id",
                "telefone": f"ilike.*{tail}*",
                "created_at": "gte.2026-09-05T00:00:00+00:00",
                "order": "created_at.asc",
                "limit": "30",
            },
        )
        print("WA_TO_ZELADOR_PHONE")
        for r in to_zelador:
            print(
                json.dumps(
                    {
                        "at": r.get("created_at"),
                        "tipo": r.get("tipo"),
                        "status": r.get("status"),
                        "tel": r.get("telefone"),
                        "msg": str(r.get("mensagem") or "")[:140],
                    },
                    ensure_ascii=False,
                )
            )

    # ops alerts around register time
    ops = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,mensagem",
            "created_at": "gte.2026-09-06T01:40:00+00:00",
            "created_at": "lte.2026-09-06T02:10:00+00:00",
            "order": "created_at.asc",
            "limit": "20",
        },
    )
    # fix double created_at - postgrest only keeps one; use and
    ops = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,mensagem",
            "and": "(created_at.gte.2026-09-06T01:40:00+00:00,created_at.lte.2026-09-06T02:30:00+00:00)",
            "order": "created_at.asc",
            "limit": "30",
        },
    )
    print("WA_AROUND_REGISTER")
    for r in ops:
        print(
            json.dumps(
                {
                    "at": r.get("created_at"),
                    "tipo": r.get("tipo"),
                    "status": r.get("status"),
                    "tel": r.get("telefone"),
                    "msg": str(r.get("mensagem") or "")[:160],
                },
                ensure_ascii=False,
            )
        )

    # search boas_vindas_zelador ever for this phone or tenant
    boas_any = sb(
        url,
        key,
        "whatsapp_logs",
        {
            "select": "id,tipo,telefone,status,created_at,mensagem,tenant_id",
            "or": "(tipo.eq.boas_vindas_zelador,tipo.eq.boas_vindas,mensagem.ilike.*boas-vindas zelador*,mensagem.ilike.*Boas-vindas zelador*)",
            "created_at": "gte.2026-09-01T00:00:00+00:00",
            "order": "created_at.desc",
            "limit": "20",
        },
    )
    print("BOAS_SEP", json.dumps(boas_any, ensure_ascii=False, indent=2)[:4000])


if __name__ == "__main__":
    main()
