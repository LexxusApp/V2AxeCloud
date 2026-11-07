#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ENV = Path(".env")
SP = ZoneInfo("America/Sao_Paulo")
SINCE = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat().replace("+00:00", "Z")


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
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(SP).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(iso)[:19]


def main():
    e = load_env()
    base = (
        e.get("SUPABASE_URL")
        or e.get("VITE_SUPABASE_URL")
        or e.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).rstrip("/")
    key = e.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    print("=== env ===")
    print("base_ok", bool(base), "key_ok", bool(key))
    print(
        "WA_META_TEMPLATE_REIVINDICACAO_APROVADA=",
        e.get("WA_META_TEMPLATE_REIVINDICACAO_APROVADA") or "MISSING",
    )

    print("=== recent claims ===")
    claims = rest(
        base,
        key,
        "terreiro_claim_requests?select=*&order=created_at.desc&limit=15",
    )
    for c in claims:
        print(
            json.dumps(
                {
                    "id": c.get("id"),
                    "status": c.get("status"),
                    "created": to_sp(c.get("created_at")),
                    "reviewed": to_sp(c.get("reviewed_at")),
                    "name": c.get("requester_name"),
                    "phone": c.get("requester_phone"),
                    "email": c.get("requester_email"),
                    "terreiro_id": c.get("terreiro_id"),
                    "linked_tenant_id": c.get("linked_tenant_id") or c.get("tenant_id"),
                    "notes": c.get("admin_notes"),
                },
                ensure_ascii=False,
                default=str,
            )
        )

    approved = [c for c in claims if str(c.get("status")) == "approved"]
    if approved:
        latest = approved[0]
        tid = str(latest.get("terreiro_id") or "")
        if tid:
            t = rest(base, key, f"terreiros_diretorio?select=id,nome,cidade,uf,slug&id=eq.{tid}")
            print("=== terreiro ===")
            print(json.dumps(t, ensure_ascii=False, default=str))

    print("=== access_logs claim approved with metadata ===")
    acc = rest(
        base,
        key,
        "access_logs?select=created_at,event_type,user_email,description,metadata,target_id"
        f"&event_type=eq.directory.claim.approved&created_at=gte.{SINCE}&order=created_at.desc&limit=10",
    )
    for a in acc:
        print(to_sp(a.get("created_at")), a.get("user_email"), a.get("description"))
        print(" target", a.get("target_id"))
        print(" meta", json.dumps(a.get("metadata"), ensure_ascii=False, default=str)[:800])


if __name__ == "__main__":
    raise SystemExit(main())
