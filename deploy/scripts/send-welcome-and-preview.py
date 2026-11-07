#!/usr/bin/env python3
"""Reenvia boas-vindas ao zelador + prévia organizada ao Lucas."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

ZELADOR_TO = "5564981036902"
LUCAS_TO = "5511920033501"
ZELADOR_NOME = "Jesue Da Cunha Lima Oliveira Mallvm"
TERREIRO = "Templo Macaia Infernal"
ZELADOR_EMAIL = "jesuemallvm@gmail.com"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def send_template(env: dict[str, str], to: str, name: str, components: list) -> str:
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    phone_id = env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID") or ""
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"
    lang = env.get("WA_META_TEMPLATE_LANGUAGE") or "pt_BR"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": name,
            "language": {"code": lang},
            "components": components,
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
        raise SystemExit(f"TEMPLATE_FAIL {name} to={to} http={e.code} {raw[:500]}") from e
    return str(((data.get("messages") or [{}])[0]).get("id") or data)[:120]


def send_text(env: dict[str, str], to: str, body: str) -> str:
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    phone_id = env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID") or ""
    ver = env.get("WA_BUSINESS_VERSION") or env.get("META_WHATSAPP_API_VERSION") or "v21.0"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
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
        raise SystemExit(f"TEXT_FAIL to={to} http={e.code} {raw[:500]}") from e
    return str(((data.get("messages") or [{}])[0]).get("id") or data)[:120]


def text_param(text: str) -> dict:
    return {"type": "text", "text": str(text or "-")[:1024]}


def main() -> int:
    env = load_env(Path(".env"))

    # 1) Boas-vindas zelador (template v2 = 1 var; se env apontar legado, 3 vars)
    welcome_name = (
        env.get("WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR") or "boas_vindas_zelador_v2_axecloud"
    ).strip()
    if "v2" in welcome_name or welcome_name.endswith("_v2_axecloud"):
        welcome_components = [
            {"type": "body", "parameters": [text_param(ZELADOR_NOME.split()[0] or ZELADOR_NOME)]}
        ]
    else:
        welcome_components = [
            {
                "type": "body",
                "parameters": [
                    text_param(ZELADOR_NOME),
                    text_param(TERREIRO),
                    text_param(ZELADOR_EMAIL),
                ],
            }
        ]

    wid_welcome = send_template(env, ZELADOR_TO, welcome_name, welcome_components)
    print("WELCOME_OK", welcome_name, "to=", ZELADOR_TO, "wamid=", wid_welcome)

    # 2) Prévia organizada ao Lucas — tenta texto livre; se falhar, usa resumo_disparo (layout em linhas)
    preview_text = (
        "Ola, Lucas!\n\n"
        "[PREVIA ORGANIZADA] Nao foi possivel entregar o WhatsApp de acesso ao membro.\n\n"
        "Membro: Tarso Mallvm Lucio dos Santos\n"
        "WhatsApp cadastro: 64981035508\n"
        "Registro: AXC-2020-9CD9\n"
        "Senha (6 digitos do CPF): 420900\n\n"
        "Passe esses dados manualmente para ele.\n"
        "Link: https://axecloud.com.br/entrar?modo=filho\n\n"
        "Mensagem automatica. Nao responda."
    )
    try:
        wid_prev = send_text(env, LUCAS_TO, preview_text)
        print("PREVIEW_TEXT_OK", "to=", LUCAS_TO, "wamid=", wid_prev)
    except SystemExit as e:
        print("PREVIEW_TEXT_FAIL", str(e)[:300])
        # Fallback: template aprovado com quebras no BODY (resumo_disparo_gira)
        resumo_name = (
            env.get("WA_META_TEMPLATE_RESUMO_DISPARO_GIRA") or "resumo_disparo_gira_axecloud"
        ).strip()
        dados = (
            "Membro: Tarso Mallvm Lucio dos Santos · "
            "WhatsApp: 64981035508 · "
            "Registro: AXC-2020-9CD9 · "
            "Senha (6 digitos CPF): 420900 · "
            "Link: https://axecloud.com.br/entrar?modo=filho"
        )
        components = [
            {
                "type": "body",
                "parameters": [
                    text_param("Lucas"),
                    text_param("falha de entrega do acesso do membro"),
                    text_param(dados),
                ],
            }
        ]
        wid_prev = send_template(env, LUCAS_TO, resumo_name, components)
        print("PREVIEW_TEMPLATE_OK", resumo_name, "to=", LUCAS_TO, "wamid=", wid_prev)

    # Também manda via ops-style template (novo_cadastro) se texto falhou? Already have fallback.
    # Extra: se texto OK, ainda assim reforça com template estruturado curto? Não — evita spam.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
