#!/usr/bin/env python3
"""Consulta status do template aviso_gira_lembrete_membro_axecloud. Não imprime token."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"
NAME = "aviso_gira_lembrete_membro_axecloud"


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

    qs = urllib.parse.urlencode(
        {"name": NAME, "fields": "id,name,status,category,language,rejected_reason"}
    )
    url = f"https://graph.facebook.com/{ver}/{waba}/message_templates?{qs}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=45) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print("HTTP", exc.code)
        print(exc.read().decode(errors="ignore")[:300])
        return 1

    rows = payload.get("data") or []
    if not rows:
        print("MISSING")
        return 2
    r = rows[0]
    print(
        "STATUS=%s CATEGORY=%s LANG=%s NAME=%s REASON=%s ID=%s"
        % (
            r.get("status") or "?",
            r.get("category") or "?",
            r.get("language") or "?",
            r.get("name") or NAME,
            r.get("rejected_reason") or "NONE",
            r.get("id") or "",
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
