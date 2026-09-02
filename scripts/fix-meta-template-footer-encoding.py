#!/usr/bin/env python3
"""Corrige rodapés Meta com mojibake (automÃ¡tica / NÃ£O) para UTF-8 correto."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = "/opt/axecloud/.env"
FOOTER_TEXT = "Mensagem automática. Não responda."
MOJIBAKE_MARKERS = ("automÃ", "NÃ£", "NÃƒ", "nÃ£", "Ã¡", "Ã©", "Ã­", "Ã³", "Ãº")
SKIP_CATEGORIES = {"AUTHENTICATION"}
SKIP_STATUS = {"PENDING_DELETION", "DELETED"}
SKIP_NAMES = {"hello_world"}


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


def graph(token: str, ver: str, method: str, path: str, body=None):
    url = f"https://graph.facebook.com/{ver}/{path}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if body is not None:
        req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="ignore")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"error": {"message": raw[:400]}}
        return exc.code, parsed


def err_text(payload: dict) -> str:
    err = payload.get("error") or {}
    parts = [
        str(err.get("message") or ""),
        str(err.get("error_user_title") or ""),
        str(err.get("error_user_msg") or ""),
    ]
    return " | ".join(p for p in parts if p)[:500]


def list_templates(token: str, ver: str, waba: str) -> list[dict]:
    out: list[dict] = []
    after = None
    while True:
        params = {
            "limit": "100",
            "fields": "id,name,status,category,language,components",
        }
        if after:
            params["after"] = after
        qs = urllib.parse.urlencode(params)
        _, payload = graph(token, ver, "GET", f"{waba}/message_templates?{qs}")
        if payload.get("error"):
            raise RuntimeError(err_text(payload))
        out.extend(payload.get("data") or [])
        paging = (payload.get("paging") or {}).get("cursors") or {}
        nxt = paging.get("after")
        if not nxt or not (payload.get("paging") or {}).get("next"):
            break
        after = nxt
    return out


def sanitize_component(comp: dict) -> dict | None:
    ctype = str(comp.get("type") or "").upper()
    if not ctype:
        return None
    clean: dict = {"type": ctype}
    if "text" in comp and comp["text"] is not None:
        clean["text"] = comp["text"]
    if "format" in comp and comp["format"]:
        clean["format"] = comp["format"]
    if "example" in comp and comp["example"]:
        clean["example"] = comp["example"]
    if "buttons" in comp and comp["buttons"]:
        buttons = []
        for btn in comp["buttons"]:
            item = {
                k: v
                for k, v in btn.items()
                if k in {"type", "text", "url", "phone_number", "example", "otp_type"}
            }
            if item:
                buttons.append(item)
        if buttons:
            clean["buttons"] = buttons
    if "add_security_recommendation" in comp:
        clean["add_security_recommendation"] = comp["add_security_recommendation"]
    if "code_expiration_minutes" in comp:
        clean["code_expiration_minutes"] = comp["code_expiration_minutes"]
    return clean


def footer_needs_fix(text: str) -> bool:
    raw = str(text or "")
    if not raw.strip():
        return True
    if raw.casefold() == FOOTER_TEXT.casefold():
        return False
    return any(marker in raw for marker in MOJIBAKE_MARKERS)


def with_fixed_footer(components: list[dict]) -> tuple[list[dict], str]:
    cleaned = []
    had_footer = False
    for raw in components or []:
        item = sanitize_component(raw)
        if not item:
            continue
        if item["type"] == "FOOTER":
            had_footer = True
            text = str(item.get("text") or "")
            if footer_needs_fix(text):
                cleaned.append({"type": "FOOTER", "text": FOOTER_TEXT})
            else:
                cleaned.append(item)
            continue
        cleaned.append(item)
    if not had_footer:
        cleaned.append({"type": "FOOTER", "text": FOOTER_TEXT})
        return cleaned, "add"
    for item in cleaned:
        if item.get("type") == "FOOTER" and item.get("text") == FOOTER_TEXT:
            return cleaned, "fix"
    return cleaned, "skip"


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

    templates = list_templates(token, ver, waba)
    print("TOTAL=%s" % len(templates))
    updated = skipped = errors = 0
    for row in sorted(templates, key=lambda x: str(x.get("name") or "")):
        name = str(row.get("name") or "")
        status = str(row.get("status") or "")
        category = str(row.get("category") or "")
        tid = str(row.get("id") or "")
        if status in SKIP_STATUS or category in SKIP_CATEGORIES or name in SKIP_NAMES:
            skipped += 1
            continue
        footer_text = ""
        for comp in row.get("components") or []:
            if str(comp.get("type") or "").upper() == "FOOTER":
                footer_text = str(comp.get("text") or "")
                break
        if not footer_needs_fix(footer_text):
            print("OK %s footer-ok" % name)
            skipped += 1
            continue
        components, action = with_fixed_footer(row.get("components") or [])
        if action == "skip":
            skipped += 1
            continue
        print("FIX %s footer=%r" % (name, footer_text[:80]))
        payload = {"components": components, "category": category}
        st, created = graph(token, ver, "POST", tid, payload)
        if created.get("error"):
            print("ERROR %s http=%s %s" % (name, st, err_text(created)))
            errors += 1
            continue
        print("UPDATED %s %s success=%s" % (name, action, created.get("success")))
        updated += 1

    print("---")
    print("UPDATED=%s SKIPPED=%s ERRORS=%s" % (updated, skipped, errors))
    return 0 if errors == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
