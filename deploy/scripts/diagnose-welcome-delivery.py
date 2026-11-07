#!/usr/bin/env python3
"""Diagnose welcome delivery + preview + config."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WELCOME_WAMID = "wamid.HBgMNTU2NDgxMDM2OTAyFQIAERgSNjY1REQyQzg2MTZDQjA5NTk5AA=="
PREVIEW_WAMID = "wamid.HBgNNTUxMTkyMDAzMzUwMRUCABEYEjNEOUY0RjY3QjYxMTIyQUYxNgA="
TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def sb(url: str, key: str, table: str, params: dict[str, str]):
    qs = urllib.parse.urlencode(params, safe="(),.*:")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{table}?{qs}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def graph(token: str, ver: str, path: str):
    req = urllib.request.Request(
        f"https://graph.facebook.com/{ver}/{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8", errors="ignore") or "{}")


def main() -> None:
    env = load_env(Path(".env"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_KEY")
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    waba = env.get("WA_BUSINESS_ACCOUNT_ID") or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID") or ""
    ver = env.get("WA_BUSINESS_VERSION") or "v21.0"
    assert url and key

    print("ENV_WELCOME_TEMPLATE", env.get("WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR") or "(unset)")
    print("ENV_META_PHONE", "SET" if (env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID")) else "NO")
    print("ENV_META_TOKEN", "SET" if token else "NO")

    # global_settings welcome_message
    try:
        rows = sb(
            url,
            key,
            "global_settings",
            {"select": "id,payload,updated_at", "id": "eq.welcome_message", "limit": "1"},
        )
        print("WELCOME_CONFIG", json.dumps(rows, ensure_ascii=False)[:1500])
    except Exception as e:
        # maybe different schema
        print("WELCOME_CONFIG_ERR", e)
        try:
            rows = sb(
                url,
                key,
                "global_settings",
                {"select": "*", "key": "eq.welcome_message", "limit": "1"},
            )
            print("WELCOME_CONFIG_KEY", json.dumps(rows, ensure_ascii=False)[:1500])
        except Exception as e2:
            print("WELCOME_CONFIG_ERR2", e2)

    # logs by wamid
    for label, wid in [("WELCOME", WELCOME_WAMID), ("PREVIEW", PREVIEW_WAMID)]:
        rows = sb(
            url,
            key,
            "whatsapp_logs",
            {"select": "id,tipo,status,telefone,created_at,mensagem", "external_id": f"eq.{wid}"},
        )
        print(f"LOG_{label}", rows)

    # recent to zelador / lucas today
    for label, tail in [("ZEL", "981036902"), ("LUCAS", "920033501")]:
        rows = sb(
            url,
            key,
            "whatsapp_logs",
            {
                "select": "created_at,tipo,status,telefone,external_id,mensagem",
                "telefone": f"ilike.*{tail}*",
                "created_at": "gte.2026-09-06T00:00:00Z",
                "order": "created_at.desc",
                "limit": "15",
            },
        )
        print(f"TODAY_{label}", len(rows))
        for r in rows:
            print(
                r["created_at"],
                r["tipo"],
                r["status"],
                str(r.get("external_id") or "")[:40],
                str(r.get("mensagem") or "")[:80],
            )

    # Meta template status
    if token and waba:
        qs = urllib.parse.urlencode(
            {
                "name": "boas_vindas_zelador_v2_axecloud",
                "fields": "id,name,status,category,rejected_reason,quality_score",
            }
        )
        code, payload = graph(token, ver, f"{waba}/message_templates?{qs}")
        print("TEMPLATE_V2", code, json.dumps(payload, ensure_ascii=False)[:800])

    # try message status - usually not available on Graph for cloud API by wamid alone
    if token:
        for label, wid in [("WELCOME", WELCOME_WAMID), ("PREVIEW", PREVIEW_WAMID)]:
            code, payload = graph(token, ver, urllib.parse.quote(wid, safe=""))
            print(f"GRAPH_{label}", code, json.dumps(payload, ensure_ascii=False)[:400])


if __name__ == "__main__":
    main()
