#!/usr/bin/env python3
"""Prévia do conta_membro_aviso_zelador_axc para o Lucas (não envia ao zelador real)."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

TO = "5511920033501"
TEMPLATE = "conta_membro_aviso_zelador_axc"
LANG = "pt_BR"

# Como o zelador veria no caso Tarso
P1 = "Lucas (previa)"
P2 = "Tarso · WA 64981035508"
P3 = (
    "Registro: AXC-2020-9CD9 · Senha (6 digitos do CPF): 420900 · "
    "Link: https://axecloud.com.br/entrar?modo=filho"
)


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main() -> int:
    env = load_env(Path(".env"))
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    phone_id = (
        env.get("WA_PHONE_NUMBER_ID")
        or env.get("META_WHATSAPP_PHONE_NUMBER_ID")
        or env.get("WA_META_PHONE_NUMBER_ID")
        or ""
    )
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"
    if not token or not phone_id:
        print("MISSING_CREDS")
        return 1

    payload = {
        "messaging_product": "whatsapp",
        "to": TO,
        "type": "template",
        "template": {
            "name": TEMPLATE,
            "language": {"code": LANG},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": P1},
                        {"type": "text", "text": P2},
                        {"type": "text", "text": P3},
                    ],
                }
            ],
        },
    }

    url = f"https://graph.facebook.com/{ver}/{phone_id}/messages"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        print("FAIL", e.code, raw[:800])
        return 1

    mid = ""
    try:
        mid = data["messages"][0]["id"]
    except Exception:
        mid = str(data)[:200]
    print("OK to=%s template=%s wamid=%s" % (TO, TEMPLATE, mid[:80]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
