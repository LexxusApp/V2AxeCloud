#!/usr/bin/env python3
"""Preview do aviso de falha de acesso (como o zelador recebe) para um número de teste."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

# Número do Lucas (prévia) — NÃO envia ao zelador real.
TO = "5511920033501"
TEMPLATE = "aviso_geral_axecloud"
LANG = "pt_BR"

# Exemplo real (Tarso) — o que o zelador veria
NOME_ZELADOR = "Lucas (previa)"
NOME_FILHO = "Tarso Mallvm Lucio dos Santos"
DADOS = (
    "Registro: AXC-2020-9CD9 · Senha (6 digitos do CPF): 420900 · "
    "Link: https://axecloud.com.br/entrar?modo=filho · WhatsApp cadastro: 64981035508"
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

    # aviso_geral: {{1}} nome, {{2}} texto livre (até ~1024)
    body_var2 = (
        f"[PREVIA] Falha WhatsApp acesso {NOME_FILHO}. "
        f"Passe estes dados manualmente: {DADOS}"
    )
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
                        {"type": "text", "text": NOME_ZELADOR},
                        {"type": "text", "text": body_var2[:1024]},
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
    print("PREVIEW_TEXT", body_var2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
