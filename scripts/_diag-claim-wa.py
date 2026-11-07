#!/usr/bin/env python3
"""Analisa reivindicacoes recentes + WA automatico."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ENV = Path(".env")
SP = ZoneInfo("America/Sao_Paulo")
NOW = datetime.now(timezone.utc)
SINCE = (NOW - timedelta(days=3)).isoformat().replace("+00:00", "Z")


def load_env():
    env = {}
    for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def rest(base, key, qs):
    req = urllib.request.Request(
        f"{base}/rest/v1/{qs}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def to_sp(iso):
    if not iso:
        return "—"
    try:
        return (
            datetime.fromisoformat(iso.replace("Z", "+00:00"))
            .astimezone(SP)
            .strftime("%d/%m/%Y %H:%M")
        )
    except Exception:
        return str(iso)[:19]


def try_tables(base, key):
    candidates = [
        "diretorio_claims?select=*&order=created_at.desc&limit=20",
        "terreiro_claims?select=*&order=created_at.desc&limit=20",
        "claims?select=*&order=created_at.desc&limit=20",
        "reivindicacoes?select=*&order=created_at.desc&limit=20",
        "diretorio_reivindicacoes?select=*&order=created_at.desc&limit=20",
    ]
    for qs in candidates:
        try:
            rows = rest(base, key, qs)
            return qs.split("?")[0], rows
        except Exception as exc:
            print("skip", qs.split("?")[0], str(exc)[:120])
    return None, []


def main():
    e = load_env()
    base = (e.get("SUPABASE_URL") or e.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = e.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    print("=== env templates ===")
    for k in [
        "WA_META_TEMPLATE_REIVINDICACAO_APROVADA",
        "WA_META_TEMPLATE_REIVINDICACAO_CONECTADA",
        "WA_META_TEMPLATE_LANGUAGE",
    ]:
        print(f"{k}={e.get(k) or 'MISSING'}")

    table, claims = try_tables(base, key)
    print("=== claims table ===", table, "count", len(claims))
    for c in claims[:10]:
        print(json.dumps({k: c.get(k) for k in list(c.keys())[:20]}, ensure_ascii=False, default=str)[:500])
        print("---")

    print("=== whatsapp claim-related last 3d ===")
    wa = rest(
        base,
        key,
        "whatsapp_logs?select=created_at,tenant_id,tipo,status,telefone,mensagem,external_id"
        f"&created_at=gte.{SINCE}&order=created_at.desc&limit=100",
    )
    for r in wa:
        tipo = str(r.get("tipo") or "")
        msg = str(r.get("mensagem") or "")
        if "reivind" in tipo.lower() or "claim" in tipo.lower() or "reivind" in msg.lower() or "claim" in msg.lower():
            print(
                to_sp(r.get("created_at")),
                r.get("tipo"),
                r.get("status"),
                r.get("telefone"),
                (msg or "")[:160],
            )

    print("=== recent WA tipos ===")
    from collections import Counter

    print(Counter(str(r.get("tipo")) for r in wa).most_common(20))

    print("=== audit claim/approve last 3d ===")
    try:
        audits = rest(
            base,
            key,
            "audit_logs?select=created_at,action,status,user_email,details,terreiro_id"
            f"&created_at=gte.{SINCE}&order=created_at.desc&limit=200",
        )
        for a in audits:
            act = str(a.get("action") or "")
            if any(x in act.lower() for x in ["claim", "reivind", "diretorio", "approve"]):
                print(to_sp(a.get("created_at")), act, a.get("status"), a.get("user_email"), str(a.get("details"))[:200])
    except Exception as exc:
        print("audit err", exc)

    print("=== access_logs claim-ish ===")
    try:
        acc = rest(
            base,
            key,
            "access_logs?select=created_at,event_type,user_email,description,tenant_id,metadata"
            f"&created_at=gte.{SINCE}&order=created_at.desc&limit=200",
        )
        for a in acc:
            et = str(a.get("event_type") or "")
            desc = str(a.get("description") or "")
            if any(x in (et + desc).lower() for x in ["claim", "reivind", "diretorio"]):
                print(to_sp(a.get("created_at")), et, a.get("user_email"), desc[:160])
    except Exception as exc:
        print("access err", exc)


if __name__ == "__main__":
    raise SystemExit(main())
