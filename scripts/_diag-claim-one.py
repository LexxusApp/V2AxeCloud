#!/usr/bin/env python3
from pathlib import Path
import json, urllib.request, urllib.error, urllib.parse
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ENV = Path(".env")
SP = ZoneInfo("America/Sao_Paulo")
CLAIM = "876f55f8-a482-4044-bd5b-ba5c358955e5"


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
    base = (e.get("SUPABASE_URL") or e.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = e.get("SUPABASE_SERVICE_ROLE_KEY") or ""

    claims = rest(base, key, f"terreiro_claim_requests?select=*&id=eq.{CLAIM}")
    c = claims[0] if claims else {}
    print("=== claim ===")
    print(json.dumps(c, ensure_ascii=False, default=str, indent=2))

    tid = str(c.get("terreiro_id") or "")
    if tid:
        for sel in [
            "id,nome,cidade,uf",
            "id,nome,cidade,estado",
            "*",
        ]:
            try:
                t = rest(base, key, f"terreiros_diretorio?select={sel}&id=eq.{tid}")
                print("=== terreiro ===", sel)
                print(json.dumps(t, ensure_ascii=False, default=str, indent=2)[:2000])
                break
            except Exception as exc:
                print("terreiro fail", sel, str(exc)[:120])

    acc = rest(
        base,
        key,
        "access_logs?select=created_at,event_type,user_email,description,metadata,target_id"
        f"&event_type=eq.directory.claim.approved&target_id=eq.{CLAIM}&order=created_at.desc&limit=5",
    )
    print("=== access_logs ===")
    for a in acc:
        print(to_sp(a.get("created_at")), a.get("user_email"), a.get("description"))
        print(json.dumps(a.get("metadata"), ensure_ascii=False, default=str, indent=2))

    phone = str(c.get("requester_phone") or "").replace("+", "").replace(" ", "")
    variants = {phone}
    if phone.startswith("55"):
        variants.add(phone[2:])
    else:
        variants.add("55" + phone)
    print("=== whatsapp_logs by phone ===")
    for p in variants:
        try:
            wa = rest(
                base,
                key,
                "whatsapp_logs?select=created_at,tenant_id,tipo,status,telefone,mensagem,external_id"
                f"&telefone=eq.{urllib.parse.quote(p)}&order=created_at.desc&limit=10",
            )
            print("phone", p, "rows", len(wa))
            for r in wa:
                print(
                    to_sp(r.get("created_at")),
                    r.get("tipo"),
                    r.get("status"),
                    r.get("telefone"),
                    (r.get("mensagem") or "")[:180],
                )
        except Exception as exc:
            print("wa err", p, exc)

    print("=== WA templates env ===")
    for k in [
        "WA_META_TEMPLATE_REIVINDICACAO_APROVADA",
        "WA_META_TEMPLATE_REIVINDICACAO_CONECTADA",
        "WA_META_PHONE_NUMBER_ID",
        "WA_META_ACCESS_TOKEN",
        "META_WHATSAPP_TOKEN",
        "WHATSAPP_TOKEN",
    ]:
        v = e.get(k) or ""
        if "TOKEN" in k or "ACCESS" in k:
            print(f"{k}={'SET' if v else 'MISSING'}")
        else:
            print(f"{k}={v or 'MISSING'}")


if __name__ == "__main__":
    raise SystemExit(main())
