#!/usr/bin/env python3
"""Fetch one Meta template by name (stdout JSON)."""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ENV_PATH = Path("/opt/axecloud/.env")


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    with path.open(encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def main() -> int:
    name = sys.argv[1] if len(sys.argv) > 1 else "aviso_geral_axecloud"
    env = load_env(ENV_PATH)
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    waba = (
        env.get("WA_BUSINESS_ACCOUNT_ID")
        or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
        or env.get("WA_WABA_ID")
        or ""
    )
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"
    qs = urllib.parse.urlencode(
        {"name": name, "fields": "id,name,status,category,language,components,rejected_reason"}
    )
    req = urllib.request.Request(
        f"https://graph.facebook.com/{ver}/{waba}/message_templates?{qs}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        payload = json.loads(res.read().decode("utf-8"))
    row = (payload.get("data") or [None])[0]
    print(json.dumps(row, ensure_ascii=False, indent=2))
    return 0 if row else 1


if __name__ == "__main__":
    raise SystemExit(main())
