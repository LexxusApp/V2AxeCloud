#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

WIDS = [
    "wamid.HBgMNTU2NDgxMDM2OTAyFQIAERgSNjY1REQyQzg2MTZDQjA5NTk5AA==",  # welcome today
    "wamid.HBgNNTUxMTkyMDAzMzUwMRUCABEYEjNEOUY0RjY3QjYxMTIyQUYxNgA=",  # preview text
    "wamid.HBgNNTUxMTkyMDAzMzUwMRUCABEYEkJGMjkxQzhGRjdCMDYyNDBGOQA=",  # preview aviso_geral
]


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get(url, key, table, params):
    q = urlencode(params, safe="(),.*:")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{table}?{q}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main():
    env = load_env(Path(".env"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_KEY")
    assert url and key

    # global_settings columns
    try:
        rows = get(url, key, "global_settings", {"select": "*", "limit": "3"})
        print("GS_SAMPLE_KEYS", list(rows[0].keys()) if rows else rows)
        for r in rows:
            print("GS_ROW", {k: (str(v)[:80] if v is not None else None) for k, v in r.items()})
    except Exception as e:
        print("GS_ERR", e)

    for wid in WIDS:
        try:
            rows = get(
                url,
                key,
                "admin_whatsapp_messages",
                {
                    "select": "id,direction,status,body,external_id,created_at,conversation_id",
                    "external_id": f"eq.{wid}",
                },
            )
            print("INBOX", wid[:40], rows)
        except Exception as e:
            print("INBOX_ERR", e)
            break

    # any inbox msgs to zelador/lucas today
    try:
        convs = get(
            url,
            key,
            "admin_whatsapp_conversations",
            {
                "select": "id,phone_e164,last_message_at,last_message_preview",
                "or": "(phone_e164.ilike.*981036902*,phone_e164.ilike.*920033501*)",
                "limit": "10",
            },
        )
        print("CONVS", json.dumps(convs, ensure_ascii=False)[:2000])
        for c in convs:
            msgs = get(
                url,
                key,
                "admin_whatsapp_messages",
                {
                    "select": "created_at,direction,status,body,external_id",
                    "conversation_id": f"eq.{c['id']}",
                    "order": "created_at.desc",
                    "limit": "8",
                },
            )
            print("MSGS", c.get("phone_e164"))
            for m in msgs:
                print(
                    m["created_at"],
                    m["direction"],
                    m["status"],
                    str(m.get("external_id") or "")[:36],
                    str(m.get("body") or "")[:100],
                )
    except Exception as e:
        print("CONV_ERR", e)


if __name__ == "__main__":
    main()
