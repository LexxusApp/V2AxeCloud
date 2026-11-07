#!/usr/bin/env python3
"""
Reenvia:
1) boas-vindas ao zelador (template) + grava whatsapp_logs
2) prévia ORGANIZADA ao Lucas via template aprovado (resumo_disparo — tem quebras no BODY)
Depois espera webhook e imprime status delivered/failed.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

ZELADOR_TO = "5564981036902"
LUCAS_TO = "5511920033501"
TENANT = "14a642ef-a88d-4a10-895c-8d41e0ab61e2"
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


def sb_req(url: str, key: str, method: str, table: str, params=None, body=None):
    qs = urlencode(params or {}, safe="(),.*:")
    full = f"{url.rstrip('/')}/rest/v1/{table}" + (f"?{qs}" if qs else "")
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    req = urllib.request.Request(full, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else None


def send_template(env: dict[str, str], to: str, name: str, components: list) -> str:
    token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN") or ""
    phone_id = env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID") or ""
    ver = env.get("WA_BUSINESS_VERSION") or "v21.0"
    lang = env.get("WA_META_TEMPLATE_LANGUAGE") or "pt_BR"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": name, "language": {"code": lang}, "components": components},
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
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"SEND_FAIL {name} {e.code} {e.read().decode()[:500]}") from e
    return str(((data.get("messages") or [{}])[0]).get("id") or "")


def text_param(t: str) -> dict:
    return {"type": "text", "text": str(t or "-")[:900]}


def wait_status(url: str, key: str, wamid: str, seconds: int = 45) -> dict | None:
    deadline = time.time() + seconds
    last = None
    while time.time() < deadline:
        rows = sb_req(
            url,
            key,
            "GET",
            "whatsapp_logs",
            {"select": "status,created_at,mensagem,tipo,telefone", "external_id": f"eq.{wamid}", "limit": "1"},
        )
        if rows:
            last = rows[0]
            st = str(last.get("status") or "").lower()
            if st in {"delivered", "read", "failed"}:
                return last
        time.sleep(3)
    return last


def main() -> int:
    env = load_env(Path(".env"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_KEY")
    assert url and key

    welcome_name = (env.get("WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR") or "boas_vindas_zelador_v2_axecloud").strip()
    wid_w = send_template(
        env,
        ZELADOR_TO,
        welcome_name,
        [{"type": "body", "parameters": [text_param(ZELADOR_NOME)]}],
    )
    print("WELCOME_SENT", welcome_name, wid_w)
    sb_req(
        url,
        key,
        "POST",
        "whatsapp_logs",
        body={
            "tenant_id": TENANT,
            "filho_id": None,
            "tipo": "boas_vindas_zelador",
            "telefone": ZELADOR_TO,
            "mensagem": f"Boas-vindas zelador: {ZELADOR_NOME} · {TERREIRO} · {ZELADOR_EMAIL} · template {welcome_name} · reenvio diagnosticado",
            "status": "sent",
            "external_id": wid_w,
        },
    )
    print("WELCOME_LOGGED")

    # Prévia organizada via template com quebras (resumo_disparo aprovado)
    resumo = (env.get("WA_META_TEMPLATE_RESUMO_DISPARO_GIRA") or "resumo_disparo_gira_axecloud").strip()
    # ops template is even clearer with labels — use novo_cadastro structure for preview clarity
    ops = (env.get("WA_META_TEMPLATE_OPS_ALERT") or "novo_cadastro_terreiro_ops_axecloud").strip()
    # Prefer ops layout (Terreiro/Zelador/Contato lines) with PREVIA prefix in fields
    try:
        wid_p = send_template(
            env,
            LUCAS_TO,
            ops,
            [
                {
                    "type": "body",
                    "parameters": [
                        text_param("[PREVIA] Falha entrega acesso membro"),
                        text_param("Tarso Mallvm Lucio dos Santos"),
                        text_param(
                            "Registro: AXC-2020-9CD9 · Senha (6 digitos CPF): 420900 · "
                            "WhatsApp: 64981035508 · Link: https://axecloud.com.br/entrar?modo=filho"
                        ),
                    ],
                }
            ],
        )
        preview_tpl = ops
    except SystemExit:
        wid_p = send_template(
            env,
            LUCAS_TO,
            resumo,
            [
                {
                    "type": "body",
                    "parameters": [
                        text_param("Lucas"),
                        text_param("falha de entrega do WhatsApp de acesso"),
                        text_param(
                            "Membro: Tarso · Registro: AXC-2020-9CD9 · Senha: 420900 · "
                            "WA: 64981035508 · https://axecloud.com.br/entrar?modo=filho"
                        ),
                    ],
                }
            ],
        )
        preview_tpl = resumo

    print("PREVIEW_SENT", preview_tpl, wid_p)
    sb_req(
        url,
        key,
        "POST",
        "whatsapp_logs",
        body={
            "tenant_id": TENANT,
            "filho_id": None,
            "tipo": "falha_acesso_membro_zelador",
            "telefone": LUCAS_TO,
            "mensagem": f"[PREVIA] Falha acesso Tarso · template {preview_tpl}",
            "status": "sent",
            "external_id": wid_p,
        },
    )
    print("PREVIEW_LOGGED")

    print("WAITING_WEBHOOK_45s...")
    w_status = wait_status(url, key, wid_w, 45)
    p_status = wait_status(url, key, wid_p, 5)
    print("WELCOME_STATUS", json.dumps(w_status, ensure_ascii=False))
    print("PREVIEW_STATUS", json.dumps(p_status, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
