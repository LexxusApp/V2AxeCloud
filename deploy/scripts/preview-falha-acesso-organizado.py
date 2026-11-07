#!/usr/bin/env python3
"""Prévia organizada (texto livre com quebras) para o Lucas — só se a janela 24h permitir."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

TO = "5511920033501"

TEXT = (
    "Ola, Lucas!\n\n"
    "[PREVIA] Nao foi possivel entregar o WhatsApp de acesso ao membro.\n\n"
    "Membro: Tarso Mallvm Lucio dos Santos\n"
    "WhatsApp cadastro: 64981035508\n"
    "Registro: AXC-2020-9CD9\n"
    "Senha (6 digitos do CPF): 420900\n\n"
    "Passe esses dados manualmente para ele.\n"
    "Link: https://axecloud.com.br/entrar?modo=filho\n\n"
    "Mensagem automatica. Nao responda."
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
        or ""
    )
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"
    if not token or not phone_id:
        print("MISSING_CREDS")
        return 1

    payload = {
        "messaging_product": "whatsapp",
        "to": TO,
        "type": "text",
        "text": {"preview_url": False, "body": TEXT},
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
        print("FAIL_TEXT", e.code, raw[:500])
        print("NOTE texto livre so funciona se voce respondeu o numero oficial nas ultimas 24h")
        return 2

    mid = ""
    try:
        mid = data["messages"][0]["id"]
    except Exception:
        mid = str(data)[:120]
    print("OK_TEXT to=%s wamid=%s" % (TO, mid[:80]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
