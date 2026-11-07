#!/usr/bin/env python3
"""Terreiros sem login ha mais de 7 dias."""
from __future__ import annotations

import json
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ENV = Path(".env")
SP = ZoneInfo("America/Sao_Paulo")
NOW = datetime.now(timezone.utc)
CUTOFF_7 = NOW - timedelta(days=7)
SINCE_90 = (NOW - timedelta(days=90)).isoformat().replace("+00:00", "Z")


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
    with urllib.request.urlopen(req, timeout=90) as r:
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
        return str(iso)[:16]


def parse_iso(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return None


def days_ago(iso):
    dt = parse_iso(iso)
    if not dt:
        return None
    return round((NOW - dt).total_seconds() / 86400.0, 1)


def main():
    e = load_env()
    base = (e.get("SUPABASE_URL") or e.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = e.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    leaders = rest(
        base,
        key,
        "perfil_lider?select=id,email,nome_terreiro,cargo,whatsapp_publico,deleted_at&deleted_at=is.null&order=nome_terreiro.asc&limit=500",
    )
    by_id = {str(r["id"]): r for r in leaders}

    subs = rest(base, key, "subscriptions?select=id,plan,status,expires_at&limit=500")
    sub_by = {str(r["id"]): r for r in subs}

    logins = rest(
        base,
        key,
        "audit_logs?select=terreiro_id,user_id,action,created_at,details"
        f"&action=eq.auth.login_success&created_at=gte.{SINCE_90}"
        "&order=created_at.desc&limit=5000",
    )

    last_login = {}
    for row in logins:
        tid = str(row.get("terreiro_id") or "").strip()
        uid = str(row.get("user_id") or "").strip()
        if not tid and uid in by_id:
            tid = uid
        if not tid or tid not in by_id:
            continue
        details = row.get("details") or {}
        if isinstance(details, dict) and str(details.get("mode") or "") == "filho":
            continue
        created = str(row.get("created_at") or "")
        if tid not in last_login or created > last_login[tid]:
            last_login[tid] = created

    # auth last_sign_in fallback
    last_sign_in = {}
    try:
        for page in range(1, 8):
            url = f"{base}/auth/v1/admin/users?page={page}&per_page=200"
            req = urllib.request.Request(
                url,
                headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                payload = json.loads(r.read().decode())
            users = payload.get("users") if isinstance(payload, dict) else payload
            if not users:
                break
            for u in users:
                uid = str(u.get("id") or "")
                if uid in by_id and u.get("last_sign_in_at"):
                    last_sign_in[uid] = str(u["last_sign_in_at"])
            if len(users) < 200:
                break
    except Exception as exc:
        last_sign_in_error = str(exc)
    else:
        last_sign_in_error = None

    # recent session for context
    sessions = rest(
        base,
        key,
        "access_logs?select=user_id,tenant_id,created_at"
        f"&event_type=in.(session.activity,session.start)&created_at=gte.{SINCE_90}"
        "&order=created_at.desc&limit=5000",
    )
    last_session = {}
    for row in sessions:
        uid = str(row.get("user_id") or "").strip()
        tid = str(row.get("tenant_id") or "").strip() or (uid if uid in by_id else "")
        if not tid or tid not in by_id:
            continue
        created = str(row.get("created_at") or "")
        if tid not in last_session or created > last_session[tid]:
            last_session[tid] = created

    INTERNAL = {
        "testeanual@axecloud.com",
        "lucasilvasiqueira@outlook.com.br",
    }

    stale = []
    active = []
    for tid, pl in by_id.items():
        email = str(pl.get("email") or "")
        login = last_login.get(tid)
        signin = last_sign_in.get(tid)
        # best login signal
        candidates = [x for x in [login, signin] if x]
        best = max(candidates) if candidates else None
        d = days_ago(best)
        row = {
            "tenant_id": tid,
            "nome": pl.get("nome_terreiro") or "(sem nome)",
            "zelador": pl.get("cargo") or "—",
            "email": email,
            "whatsapp": pl.get("whatsapp_publico") or "—",
            "plan": (sub_by.get(tid) or {}).get("plan") or "—",
            "sub_status": (sub_by.get(tid) or {}).get("status") or "—",
            "expires_sp": to_sp((sub_by.get(tid) or {}).get("expires_at")),
            "last_login_sp": to_sp(best),
            "days_without_login": d,
            "last_session_sp": to_sp(last_session.get(tid)),
            "internal": email.lower() in INTERNAL,
        }
        if best is None or (d is not None and d > 7):
            stale.append(row)
        else:
            active.append(row)

    stale.sort(key=lambda r: (r["days_without_login"] is None, -(r["days_without_login"] or 0)))
    active.sort(key=lambda r: r["days_without_login"] or 0)

    report = {
        "generated_sp": datetime.now(SP).strftime("%d/%m/%Y %H:%M"),
        "cutoff_days": 7,
        "totals": {
            "terreiros": len(by_id),
            "sem_login_mais_7d": len(stale),
            "com_login_7d": len(active),
            "sem_login_nunca": sum(1 for r in stale if r["days_without_login"] is None),
        },
        "stale": stale,
        "active": active,
        "notes": {"last_sign_in_error": last_sign_in_error},
    }
    print(json.dumps(report, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
