#!/usr/bin/env python3
"""AxéCloud — relatório de uso das últimas 24h (America/Sao_Paulo)."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ENV = Path(".env")
SP = ZoneInfo("America/Sao_Paulo")
PAGE = 1000

MODULE_KEYS = ("agenda", "mural", "biblioteca", "membros", "financeiro")
MODULE_PATTERNS = {
    "agenda": re.compile(r"\b(agenda|calendar|evento|gira|frequencia)\b", re.I),
    "mural": re.compile(r"\b(mural|comunicado)\b", re.I),
    "biblioteca": re.compile(r"\b(biblioteca|library|estudo)\b", re.I),
    "membros": re.compile(r"\b(membro|membros|filho|filhos|children)\b", re.I),
    "financeiro": re.compile(r"\b(financeiro|financial|mensalidade|caixa)\b", re.I),
}

# Public directory clicks are not tenant-panel module activity.
DIRECTORY_FALSE_POSITIVE = re.compile(
    r"directory\.(profile_google_view|whatsapp_click|profile_click)",
    re.I,
)
SHADOW_FILHO_F = re.compile(r"^f_([0-9a-f-]{36})@axecloud\.internal$", re.I)
SHADOW_FILHO_LEGACY = re.compile(r"^filho_([0-9a-f-]+)@axecloud\.com$", re.I)


def load_env():
    env = {}
    for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def rest_page(base, key, table_qs, offset, limit=PAGE):
    url = f"{base}/rest/v1/{table_qs}"
    sep = "&" if "?" in table_qs else "?"
    if "limit=" not in table_qs:
        url = f"{url}{sep}limit={limit}&offset={offset}"
    else:
        url = f"{url}{sep}offset={offset}" if "offset=" not in table_qs else url
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "Prefer": "count=exact",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read().decode()
        return json.loads(body) if body.strip() else []


def rest_all(base, key, table_qs, max_rows=20000):
    rows = []
    offset = 0
    while offset < max_rows:
        batch = rest_page(base, key, table_qs, offset)
        if not isinstance(batch, list):
            return batch
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    return rows


def try_rest_all(base, key, table_qs, label, notes, max_rows=20000):
    try:
        return rest_all(base, key, table_qs, max_rows=max_rows)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")[:300]
        notes.append(f"{label}: HTTP {exc.code} — {body}")
        return []
    except Exception as exc:
        notes.append(f"{label}: {exc}")
        return []


def parse_iso(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except Exception:
        return None


def to_sp_iso(dt: datetime) -> str:
    return dt.astimezone(SP).strftime("%Y-%m-%dT%H:%M:%S%z")


def to_sp_stamp(iso) -> str | None:
    dt = parse_iso(iso)
    if not dt:
        return None
    return dt.astimezone(SP).strftime("%Y-%m-%d %H:%M:%S")


def hour_bucket_sp(iso) -> str | None:
    dt = parse_iso(iso)
    if not dt:
        return None
    local = dt.astimezone(SP)
    return local.strftime("%Y-%m-%d %H:00")


def as_dict(details):
    if isinstance(details, dict):
        return details
    if isinstance(details, str):
        try:
            parsed = json.loads(details)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def classify_module(text: str) -> str | None:
    if not text:
        return None
    if DIRECTORY_FALSE_POSITIVE.search(text):
        return None
    # Anything that looks like public directory surface is not panel activity.
    if re.search(r"\bdirectory\.", text, re.I):
        return None
    for key, pat in MODULE_PATTERNS.items():
        if pat.search(text):
            return key
    return None


def resolve_tenant(tid, uid, by_id, email_to_id=None, email=None, filho_house=None):
    tid = str(tid or "").strip()
    uid = str(uid or "").strip()
    email_l = str(email or "").strip().lower()

    if filho_house:
        if tid and tid in filho_house:
            return filho_house[tid]
        if uid and uid in filho_house:
            return filho_house[uid]
        if email_l and email_l in filho_house:
            return filho_house[email_l]

    if tid and tid in by_id:
        return tid
    if uid and uid in by_id:
        return uid
    if email_l and email_to_id and email_l in email_to_id:
        return email_to_id[email_l]
    return tid or uid or None


def is_filho_signal(email=None, details=None, role=None) -> bool:
    email_l = str(email or "").strip().lower()
    if email_l.endswith("@axecloud.internal") or email_l.endswith("@axecloud.com") and email_l.startswith("filho_"):
        return True
    d = as_dict(details) if details is not None else {}
    if str(d.get("mode") or "").lower() == "filho":
        return True
    if str(role or d.get("role") or "").lower() == "filho":
        return True
    return False


def build_filho_house_map(base, key, notes, leaders_by_id):
    """Map shadow email / filho id / user_id → parent terreiro (tenant_id or lider_id)."""
    house = {}
    rows = try_rest_all(
        base,
        key,
        "filhos_de_santo?select=id,user_id,email,lider_id,tenant_id",
        "filhos_de_santo house map",
        notes,
        max_rows=30000,
    )
    for r in rows:
        parent = str(r.get("tenant_id") or r.get("lider_id") or "").strip()
        if not parent:
            continue
        # Prefer parent that exists in perfil_lider when possible
        if parent not in leaders_by_id:
            alt = str(r.get("lider_id") or r.get("tenant_id") or "").strip()
            if alt in leaders_by_id:
                parent = alt
        fid = str(r.get("id") or "").strip()
        uid = str(r.get("user_id") or "").strip()
        if fid:
            house[fid] = parent
            house[f"f_{fid}@axecloud.internal".lower()] = parent
        if uid:
            house[uid] = parent
        em_l = str(r.get("email") or "").strip().lower()
        if em_l:
            house[em_l] = parent
    notes.append(f"filho house map entries: {len(house)} from {len(rows)} filhos_de_santo rows")
    return house


def extract_filho_id_from_email(email: str) -> str | None:
    e = str(email or "").strip().lower()
    m = SHADOW_FILHO_F.match(e)
    if m:
        return m.group(1)
    m = SHADOW_FILHO_LEGACY.match(e)
    if m:
        return m.group(1)
    return None


def main():
    notes = []
    e = load_env()
    base = (e.get("SUPABASE_URL") or e.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = e.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        raise SystemExit("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env")

    now_utc = datetime.now(timezone.utc)
    start_utc = now_utc - timedelta(hours=24)
    since = start_utc.isoformat().replace("+00:00", "Z")
    now_sp = now_utc.astimezone(SP)
    start_sp = start_utc.astimezone(SP)

    leaders = try_rest_all(
        base,
        key,
        "perfil_lider?select=id,email,nome_terreiro,created_at,deleted_at,role,tenant_id"
        "&deleted_at=is.null&order=created_at.desc",
        "perfil_lider",
        notes,
    )
    by_id = {str(r["id"]): r for r in leaders if r.get("id")}
    email_to_id = {}
    for r in leaders:
        em = str(r.get("email") or "").strip().lower()
        if em and em not in email_to_id:
            email_to_id[em] = str(r["id"])
        # also map tenant_id → same leader when distinct
        tid = str(r.get("tenant_id") or "").strip()
        if tid and tid not in by_id:
            by_id[tid] = r

    filho_house = build_filho_house_map(base, key, notes, by_id)

    # --- logins ---
    logins = try_rest_all(
        base,
        key,
        "audit_logs?select=id,action,status,terreiro_id,user_id,user_email,details,created_at"
        f"&action=in.(auth.login_success,auth.login_failed)&created_at=gte.{since}"
        "&order=created_at.desc",
        "audit_logs logins",
        notes,
    )
    if not logins:
        logins = try_rest_all(
            base,
            key,
            "audit_logs?select=id,action,status,terreiro_id,user_id,user_email,details,created_at"
            f"&action=ilike.*login*&created_at=gte.{since}&order=created_at.desc",
            "audit_logs login fallback",
            notes,
        )

    logins_ok = 0
    logins_fail = 0
    logins_ok_filho = 0
    logins_ok_zelador = 0
    login_by_tenant = defaultdict(lambda: {"ok": 0, "fail": 0, "ok_filho": 0})
    login_hours = defaultdict(int)
    login_fail_hours = defaultdict(int)
    login_timestamps_sp = []

    for row in logins:
        action = str(row.get("action") or "")
        details = as_dict(row.get("details"))
        email = row.get("user_email")
        is_filho = is_filho_signal(email=email, details=details)
        # Prefer explicit terreiro_id; for filho fall back via house map
        tid = resolve_tenant(
            row.get("terreiro_id"),
            row.get("user_id"),
            by_id,
            email_to_id,
            email,
            filho_house=filho_house,
        )
        if is_filho and not (tid and tid in by_id):
            fid = str(details.get("filhoId") or "").strip() or extract_filho_id_from_email(email or "")
            if fid and fid in filho_house:
                tid = filho_house[fid]
        hb = hour_bucket_sp(row.get("created_at"))
        stamp = to_sp_stamp(row.get("created_at"))
        is_ok = action == "auth.login_success" or (
            "login" in action and str(row.get("status") or "").lower() == "success"
        )
        is_fail = action == "auth.login_failed" or (
            "login" in action and str(row.get("status") or "").lower() in ("failed", "fail", "error")
        )
        if stamp:
            login_timestamps_sp.append(
                {
                    "sp": stamp,
                    "action": action,
                    "ok": bool(is_ok),
                    "fail": bool(is_fail),
                    "filho": bool(is_filho),
                    "email": email or "",
                    "tenant_id": tid,
                    "nome": (by_id.get(tid) or {}).get("nome_terreiro") if tid else None,
                }
            )
        if is_ok:
            if is_filho:
                logins_ok_filho += 1
                if tid:
                    login_by_tenant[tid]["ok_filho"] += 1
            else:
                logins_ok += 1
                logins_ok_zelador += 1
                if tid:
                    login_by_tenant[tid]["ok"] += 1
                if hb:
                    login_hours[hb] += 1
            # filho ok also contributes to hourly login presence (separate from zelador count)
            if is_filho and hb:
                # keep filho out of logins_ok hourly; tracked via notes only
                pass
        elif is_fail:
            logins_fail += 1
            if tid:
                login_by_tenant[tid]["fail"] += 1
            if hb:
                login_fail_hours[hb] += 1

    login_timestamps_sp.sort(key=lambda r: r.get("sp") or "", reverse=True)

    # --- sessions (session.activity / heartbeat) ---
    sessions = try_rest_all(
        base,
        key,
        "access_logs?select=id,event_type,user_id,user_email,tenant_id,created_at,description,metadata,target_type,target_id"
        f"&or=(event_type.ilike.*session*,event_type.ilike.*heartbeat*)&created_at=gte.{since}"
        "&order=created_at.desc",
        "access_logs sessions",
        notes,
    )
    session_count = 0
    session_by_tenant = defaultdict(int)
    session_hours = defaultdict(int)
    last_activity = {}

    for row in sessions:
        et = str(row.get("event_type") or "").lower()
        if "session" not in et and "heartbeat" not in et:
            continue
        if DIRECTORY_FALSE_POSITIVE.search(et):
            continue
        session_count += 1
        email = row.get("user_email")
        tid = resolve_tenant(
            row.get("tenant_id"),
            row.get("user_id"),
            by_id,
            email_to_id,
            email,
            filho_house=filho_house,
        )
        if is_filho_signal(email=email, details=row.get("metadata")) and tid and tid not in by_id:
            fid = extract_filho_id_from_email(email or "")
            if fid and fid in filho_house:
                tid = filho_house[fid]
        if tid:
            session_by_tenant[tid] += 1
            created = str(row.get("created_at") or "")
            if tid not in last_activity or created > last_activity[tid]:
                last_activity[tid] = created
        hb = hour_bucket_sp(row.get("created_at"))
        if hb:
            session_hours[hb] += 1

    # --- whatsapp ---
    wa_rows = try_rest_all(
        base,
        key,
        "whatsapp_logs?select=id,tipo,status,tenant_id,created_at,telefone,mensagem"
        f"&created_at=gte.{since}&order=created_at.desc",
        "whatsapp_logs",
        notes,
    )
    wa_by_tipo = defaultdict(lambda: defaultdict(int))
    wa_by_tenant = defaultdict(int)
    wa_hours = defaultdict(int)
    for row in wa_rows:
        tipo = str(row.get("tipo") or "unknown")
        status = str(row.get("status") or "unknown")
        wa_by_tipo[tipo][status] += 1
        tid = resolve_tenant(row.get("tenant_id"), None, by_id, filho_house=filho_house)
        if tid:
            wa_by_tenant[tid] += 1
            created = str(row.get("created_at") or "")
            if tid not in last_activity or created > last_activity[tid]:
                last_activity[tid] = created
        hb = hour_bucket_sp(row.get("created_at"))
        if hb:
            wa_hours[hb] += 1

    # --- real module activity: tenant panel only, with tenant_id ---
    module_counts = {k: 0 for k in MODULE_KEYS}
    module_by_tenant = defaultdict(lambda: {k: 0 for k in MODULE_KEYS})
    module_sources = []
    skipped_directory = 0
    skipped_no_tenant = 0

    access_mod = try_rest_all(
        base,
        key,
        "access_logs?select=id,event_type,user_id,user_email,tenant_id,created_at,description,metadata,target_type"
        f"&created_at=gte.{since}&order=created_at.desc",
        "access_logs all (modules)",
        notes,
        max_rows=15000,
    )
    for row in access_mod:
        et = str(row.get("event_type") or "")
        et_l = et.lower()
        if "session" in et_l or "heartbeat" in et_l:
            continue
        if DIRECTORY_FALSE_POSITIVE.search(et) or et_l.startswith("directory."):
            skipped_directory += 1
            continue
        blob = " ".join(
            [
                et,
                str(row.get("description") or ""),
                str(row.get("target_type") or ""),
                json.dumps(row.get("metadata") or {}, ensure_ascii=False),
            ]
        )
        if DIRECTORY_FALSE_POSITIVE.search(blob) or re.search(r"\bdirectory\.", blob, re.I):
            skipped_directory += 1
            continue
        mod = classify_module(blob)
        if not mod:
            continue
        email = row.get("user_email")
        tid = resolve_tenant(
            row.get("tenant_id"),
            row.get("user_id"),
            by_id,
            email_to_id,
            email,
            filho_house=filho_house,
        )
        # Real module activity only with clear tenant attribution to a known terreiro
        if not tid or tid not in by_id:
            skipped_no_tenant += 1
            continue
        module_counts[mod] += 1
        module_by_tenant[tid][mod] += 1
        created = str(row.get("created_at") or "")
        if tid not in last_activity or created > last_activity[tid]:
            last_activity[tid] = created

    audit_mod = try_rest_all(
        base,
        key,
        "audit_logs?select=id,action,terreiro_id,user_id,user_email,details,created_at"
        f"&created_at=gte.{since}&order=created_at.desc",
        "audit_logs all (modules)",
        notes,
        max_rows=15000,
    )
    for row in audit_mod:
        action = str(row.get("action") or "")
        if action.startswith("auth.login"):
            continue
        if DIRECTORY_FALSE_POSITIVE.search(action) or action.lower().startswith("directory."):
            skipped_directory += 1
            continue
        blob = " ".join([action, json.dumps(as_dict(row.get("details")), ensure_ascii=False)])
        if DIRECTORY_FALSE_POSITIVE.search(blob) or re.search(r"\bdirectory\.", blob, re.I):
            skipped_directory += 1
            continue
        mod = classify_module(blob)
        if not mod:
            continue
        email = row.get("user_email")
        tid = resolve_tenant(
            row.get("terreiro_id"),
            row.get("user_id"),
            by_id,
            email_to_id,
            email,
            filho_house=filho_house,
        )
        if not tid or tid not in by_id:
            skipped_no_tenant += 1
            continue
        module_counts[mod] += 1
        module_by_tenant[tid][mod] += 1

    if sum(module_counts.values()) == 0:
        module_sources.append("no module-tagged access/audit events with tenant_id; using domain table creates")
        domain_tables = {
            "agenda": [
                "calendario_axe?select=id,tenant_id,created_at",
                "eventos?select=id,tenant_id,created_at",
            ],
            "mural": [
                "mural_avisos?select=id,tenant_id,created_at",
            ],
            "biblioteca": [
                "biblioteca?select=id,tenant_id,created_at",
            ],
            "membros": [
                "filhos_de_santo?select=id,tenant_id,created_at",
            ],
            "financeiro": [
                "financeiro?select=id,tenant_id,created_at",
            ],
        }
        for mod, candidates in domain_tables.items():
            got = False
            for qs in candidates:
                table = qs.split("?")[0]
                rows = try_rest_all(
                    base,
                    key,
                    f"{qs}&created_at=gte.{since}&order=created_at.desc",
                    f"domain {table}",
                    notes,
                    max_rows=5000,
                )
                if notes and f"domain {table}" in notes[-1] and (
                    "does not exist" in notes[-1]
                    or "PGRST" in notes[-1]
                    or "HTTP 404" in notes[-1]
                    or "HTTP 400" in notes[-1]
                ):
                    continue
                counted = 0
                for row in rows:
                    tid = resolve_tenant(row.get("tenant_id"), None, by_id, filho_house=filho_house)
                    if not tid or tid not in by_id:
                        continue
                    module_counts[mod] += 1
                    module_by_tenant[tid][mod] += 1
                    counted += 1
                if counted or rows is not None:
                    got = True
                    module_sources.append(f"{mod}←{table}(tenanted={counted}/raw={len(rows)})")
                    break
            if not got:
                module_sources.append(f"{mod}: unavailable")
    else:
        module_sources.append("from access_logs/audit_logs keyword match with tenant_id")

    module_sources.append(
        f"skipped directory false-positives={skipped_directory}; skipped no/unknown tenant={skipped_no_tenant}"
    )

    # --- new terreiros ---
    new_leaders = [
        r
        for r in leaders
        if (parse_iso(r.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc)) >= start_utc
        and str(r.get("role") or "").lower() != "filho"
    ]
    new_terreiros = [
        {
            "id": str(r.get("id")),
            "nome_terreiro": r.get("nome_terreiro") or "(sem nome)",
            "email": r.get("email") or "",
            "created_sp": (
                parse_iso(r.get("created_at")).astimezone(SP).strftime("%Y-%m-%d %H:%M:%S")
                if parse_iso(r.get("created_at"))
                else None
            ),
        }
        for r in sorted(new_leaders, key=lambda x: str(x.get("created_at") or ""), reverse=True)
    ]

    # --- claims ---
    claims_created = try_rest_all(
        base,
        key,
        "terreiro_claim_requests?select=id,terreiro_id,requester_name,requester_email,requester_phone,status,"
        "claimed_tenant_id,reviewed_at,created_at,updated_at,admin_notes"
        f"&created_at=gte.{since}&order=created_at.desc",
        "claims created",
        notes,
    )
    claims_reviewed = try_rest_all(
        base,
        key,
        "terreiro_claim_requests?select=id,terreiro_id,requester_name,requester_email,requester_phone,status,"
        "claimed_tenant_id,reviewed_at,created_at,updated_at,admin_notes"
        f"&reviewed_at=gte.{since}&order=reviewed_at.desc",
        "claims reviewed",
        notes,
    )
    claims_by_id = {}
    for row in claims_created + claims_reviewed:
        cid = str(row.get("id") or "")
        if cid:
            claims_by_id[cid] = row

    dir_ids = {str(r.get("terreiro_id")) for r in claims_by_id.values() if r.get("terreiro_id")}
    dir_names = {}
    if dir_ids:
        ids = list(dir_ids)
        for i in range(0, len(ids), 50):
            chunk = ids[i : i + 50]
            inlist = ",".join(chunk)
            rows = try_rest_all(
                base,
                key,
                f"terreiros_diretorio?select=id,nome&id=in.({inlist})",
                "terreiros_diretorio",
                notes,
            )
            for r in rows:
                dir_names[str(r.get("id"))] = r.get("nome") or "(sem nome)"

    claims_list = []
    for row in claims_by_id.values():
        claimed = str(row.get("claimed_tenant_id") or "")
        pl = by_id.get(claimed) or {}
        created_dt = parse_iso(row.get("created_at"))
        reviewed_dt = parse_iso(row.get("reviewed_at"))
        claims_list.append(
            {
                "id": str(row.get("id")),
                "status": row.get("status"),
                "requester_name": row.get("requester_name"),
                "requester_email": row.get("requester_email"),
                "requester_phone": row.get("requester_phone"),
                "directory_terreiro": dir_names.get(
                    str(row.get("terreiro_id") or ""), str(row.get("terreiro_id") or "")
                ),
                "claimed_tenant_id": claimed or None,
                "claimed_nome": pl.get("nome_terreiro"),
                "claimed_email": pl.get("email"),
                "created_sp": created_dt.astimezone(SP).strftime("%Y-%m-%d %H:%M:%S") if created_dt else None,
                "reviewed_sp": reviewed_dt.astimezone(SP).strftime("%Y-%m-%d %H:%M:%S") if reviewed_dt else None,
                "created_in_window": bool(created_dt and created_dt >= start_utc),
                "reviewed_in_window": bool(reviewed_dt and reviewed_dt >= start_utc),
            }
        )
    claims_list.sort(key=lambda r: r.get("created_sp") or "", reverse=True)

    for row in logins:
        tid = resolve_tenant(
            row.get("terreiro_id"),
            row.get("user_id"),
            by_id,
            email_to_id,
            row.get("user_email"),
            filho_house=filho_house,
        )
        if not tid:
            continue
        created = str(row.get("created_at") or "")
        if tid not in last_activity or created > last_activity[tid]:
            last_activity[tid] = created

    # --- by_terreiro ---
    active_ids = (
        set(login_by_tenant) | set(session_by_tenant) | set(wa_by_tenant) | set(module_by_tenant) | set(last_activity)
    )
    by_terreiro = []
    for tid in active_ids:
        pl = by_id.get(tid) or {}
        # skip pure filho perfil rows if any leaked
        if str(pl.get("role") or "").lower() == "filho":
            parent = filho_house.get(tid)
            if parent and parent in by_id:
                continue
        mods = module_by_tenant.get(tid) or {k: 0 for k in MODULE_KEYS}
        mods_nz = {k: v for k, v in mods.items() if v}
        lg = login_by_tenant.get(tid) or {"ok": 0, "fail": 0, "ok_filho": 0}
        sess = session_by_tenant.get(tid, 0)
        wa = wa_by_tenant.get(tid, 0)
        activity_score = lg["ok"] + lg["ok_filho"] + sess + wa + sum(mods.values())
        la = parse_iso(last_activity.get(tid))
        by_terreiro.append(
            {
                "tenant_id": tid,
                "nome": pl.get("nome_terreiro") or ("(desconhecido)" if not pl else "(sem nome)"),
                "email": pl.get("email") or "",
                "logins_ok": lg["ok"],
                "logins_fail": lg["fail"],
                "logins_filho": lg["ok_filho"],
                "sessions": sess,
                "whatsapp": wa,
                "modules": mods_nz,
                "last_activity_sp": la.astimezone(SP).strftime("%Y-%m-%d %H:%M:%S") if la else None,
                "activity_score": activity_score,
                "known_perfil": bool(pl),
            }
        )
    by_terreiro.sort(key=lambda r: r["activity_score"], reverse=True)

    # --- by_hour (full continuous window) ---
    all_hours = sorted(set(login_hours) | set(login_fail_hours) | set(session_hours) | set(wa_hours))
    cursor = start_sp.replace(minute=0, second=0, microsecond=0)
    end_hour = now_sp.replace(minute=0, second=0, microsecond=0)
    filled = []
    while cursor <= end_hour:
        key_h = cursor.strftime("%Y-%m-%d %H:00")
        filled.append(key_h)
        cursor += timedelta(hours=1)
    for h in all_hours:
        if h not in filled:
            filled.append(h)
    filled = sorted(set(filled))

    by_hour = [
        {
            "hour_sp": h,
            "logins_ok": login_hours.get(h, 0),
            "logins_fail": login_fail_hours.get(h, 0),
            "sessions": session_hours.get(h, 0),
            "whatsapp": wa_hours.get(h, 0),
        }
        for h in filled
    ]
    hours_with_events = [
        h
        for h in by_hour
        if (h["logins_ok"] + h["logins_fail"] + h["sessions"] + h["whatsapp"]) > 0
    ]

    # reading notes
    reading_notes = []
    reading_notes.append(
        f"Janela SP: {start_sp.strftime('%d/%m %H:%M')} → {now_sp.strftime('%d/%m %H:%M')} ({since} UTC → now)."
    )
    reading_notes.append(
        f"Logins zelador OK={logins_ok}, filho OK={logins_ok_filho} (excluídos do total zelador), falhas={logins_fail}."
    )
    reading_notes.append(f"Sessões/heartbeats={session_count}; WhatsApp msgs={len(wa_rows)}.")
    # Hours WITH events only in notes
    if hours_with_events:
        reading_notes.append(
            "Horas SP com eventos: "
            + "; ".join(
                f"{h['hour_sp']} (ok={h['logins_ok']} fail={h['logins_fail']} sess={h['sessions']} wa={h['whatsapp']})"
                for h in hours_with_events
            )
        )
    else:
        reading_notes.append("Nenhuma hora SP com eventos na janela.")
    top = by_terreiro[:5]
    if top:
        reading_notes.append(
            "Top atividade: " + "; ".join(f"{t['nome']} (score {t['activity_score']})" for t in top)
        )
    if new_terreiros:
        reading_notes.append(
            f"Novos perfil_lider: {len(new_terreiros)} — "
            + ", ".join(f"{t['nome_terreiro']}<{t['email']}>" for t in new_terreiros[:8])
        )
    else:
        reading_notes.append("Nenhum perfil_lider criado nas últimas 24h.")
    if claims_list:
        reading_notes.append(
            f"Claims na janela: {len(claims_list)} "
            f"(criados={sum(1 for c in claims_list if c['created_in_window'])}, "
            f"revisados={sum(1 for c in claims_list if c['reviewed_in_window'])})."
        )
    else:
        reading_notes.append("Nenhum terreiro_claim_request criado/revisado nas últimas 24h.")
    wa_tipos = {t: sum(st.values()) for t, st in wa_by_tipo.items()}
    if wa_tipos:
        reading_notes.append(
            "WA por tipo: " + ", ".join(f"{k}={v}" for k, v in sorted(wa_tipos.items(), key=lambda x: -x[1]))
        )
    reading_notes.append("Módulos: " + ", ".join(f"{k}={module_counts[k]}" for k in MODULE_KEYS))
    reading_notes.append(
        "Excluídos de módulos: directory.profile_google_view / whatsapp_click (e demais directory.*)."
    )
    reading_notes.extend(f"src: {s}" for s in module_sources[:8])
    if notes:
        reading_notes.append(f"Avisos técnicos: {len(notes)} (ver reading_notes_tech).")

    report = {
        "window_sp_start": to_sp_iso(start_sp),
        "window_sp_end": to_sp_iso(now_sp),
        "generated_sp": to_sp_iso(now_sp),
        "window_utc_start": since,
        "totals": {
            "logins_ok": logins_ok,
            "logins_ok_filho": logins_ok_filho,
            "logins_ok_zelador": logins_ok_zelador,
            "logins_fail": logins_fail,
            "sessions": session_count,
            "whatsapp": len(wa_rows),
            "modules": module_counts,
            "new_terreiros": len(new_terreiros),
            "claims": {
                "created": sum(1 for c in claims_list if c["created_in_window"]),
                "reviewed": sum(1 for c in claims_list if c["reviewed_in_window"]),
                "unique": len(claims_list),
            },
            "terreiros_active": len([t for t in by_terreiro if t["activity_score"] > 0]),
        },
        "by_terreiro": by_terreiro,
        "by_hour": by_hour,
        "wa_by_tipo": {t: dict(st) for t, st in sorted(wa_by_tipo.items())},
        "claims": claims_list,
        "new_terreiros": new_terreiros,
        "reading_notes": reading_notes,
        "login_timestamps_sp": login_timestamps_sp,
        "reading_notes_tech": notes[:40],
    }
    print(json.dumps(report, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
