#!/usr/bin/env python3
"""Lista templates Meta do WABA (nome, status, categoria). Nao imprime token."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = ".env"


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


def graph(token: str, ver: str, path: str):
    url = f"https://graph.facebook.com/{ver}/{path}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="ignore")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"error": {"message": raw[:400]}}
        return exc.code, parsed


def main() -> int:
    env = load_env(ENV_PATH)
    token = (env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or "").strip()
    waba = (
        env.get("WA_BUSINESS_ACCOUNT_ID")
        or env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID")
        or env.get("WA_WABA_ID")
        or ""
    ).strip()
    ver = (env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0").strip()
    if not token or not waba:
        print("MISSING_CREDS")
        return 1

    rows = []
    after = None
    while True:
        qs = {
            "fields": "name,status,category,language,id,rejected_reason",
            "limit": "100",
        }
        if after:
            qs["after"] = after
        code, payload = graph(token, ver, f"{waba}/message_templates?{urllib.parse.urlencode(qs)}")
        if code >= 400:
            print("FAIL", json.dumps(payload, ensure_ascii=False)[:500])
            return 1
        rows.extend(payload.get("data") or [])
        paging = (payload.get("paging") or {}).get("cursors") or {}
        after = paging.get("after")
        if not after or not (payload.get("paging") or {}).get("next"):
            break

    rows.sort(key=lambda r: (str(r.get("status") or ""), str(r.get("name") or "")))
    print(f"TOTAL={len(rows)}")
    for r in rows:
        print(
            f"{r.get('status')}\t{r.get('category')}\t{r.get('language')}\t{r.get('name')}\tid={r.get('id')}\treject={r.get('rejected_reason') or '-'}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
