#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ENV = Path(".env")
SP = ZoneInfo("America/Sao_Paulo")
CLAIM = "876f55f8-a482-4044-bd5b-ba5c358955e5"
WAMID = "wamid.HBgNNTUyMjk4ODQ2OTg5NhUCABEYEjE2NTgxNzFBMDA2MEQwNjAxNgA="
PHONES = ["5522988469896", "22988469896"]


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
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(SP).strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return str(iso)[:19]


def try_rest(base, key, qs, label):
    try:
        rows = rest(base, key, qs)
        print(f"=== {label} === count={len(rows) if isinstance(rows, list) else 1}")
        print(json.dumps(rows, ensure_ascii=False, default=str)[:2500])
    except Exception as exc:
        print(f"=== {label} === ERR {exc}")


def main():
    e = load_env()
    base = (e.get("SUPABASE_URL") or e.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = e.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    wamid_q = urllib.parse.quote(WAMID, safe="")

    claim = rest(base, key, f"terreiro_claim_requests?select=id,status,claimed_tenant_id,reviewed_at,updated_at,requester_phone,requester_name&id=eq.{CLAIM}")
    print("=== claim ===")
    print(json.dumps(claim, ensure_ascii=False, default=str, indent=2))

    try_rest(
        base,
        key,
        f"whatsapp_logs?select=created_at,tipo,status,telefone,mensagem,external_id,tenant_id&or=(external_id.eq.{wamid_q},telefone.eq.5522988469896,telefone.eq.22988469896)&order=created_at.desc&limit=20",
        "whatsapp_logs",
    )
    try_rest(
        base,
        key,
        f"whatsapp_deliveries?select=*&or=(external_id.eq.{wamid_q},phone.eq.5522988469896,to_phone.eq.5522988469896)&order=created_at.desc&limit=20",
        "whatsapp_deliveries",
    )
    try_rest(
        base,
        key,
        f"whatsapp_delivery_events?select=*&or=(external_id.eq.{wamid_q},message_id.eq.{wamid_q})&order=created_at.desc&limit=20",
        "whatsapp_delivery_events",
    )
    try_rest(
        base,
        key,
        f"admin_whatsapp_messages?select=created_at,direction,status,external_id,body,phone&or=(external_id.eq.{wamid_q},phone.ilike.*2988469896*)&order=created_at.desc&limit=20",
        "admin_whatsapp_messages",
    )
    try_rest(
        base,
        key,
        f"admin_whatsapp_conversations?select=*&or=(phone_e164.eq.5522988469896,phone_e164.ilike.*2988469896*)&order=updated_at.desc&limit=5",
        "admin_whatsapp_conversations",
    )

    since = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat().replace("+00:00", "Z")
    try_rest(
        base,
        key,
        "access_logs?select=created_at,event_type,description,metadata,target_id"
        f"&target_id=eq.{CLAIM}&order=created_at.desc&limit=10",
        "access_logs claim",
    )
    # any register activity for this claim email?
    try_rest(
        base,
        key,
        "perfil_lider?select=id,email,nome_terreiro,created_at,whatsapp_publico"
        "&email=eq.gracinhadecabofrio@gmail.com",
        "perfil by email",
    )


if __name__ == "__main__":
    raise SystemExit(main())
