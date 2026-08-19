#!/usr/bin/env python3
"""
Edita dois templates Meta (executar após 24h do último edit):
1. aviso_portal_conta_axecloud  — novo texto direto + botão URL
2. mensalidade_vence_hoje_axecloud — texto neutro (sem tom promocional)
"""
from pathlib import Path
import json, urllib.parse, urllib.request, urllib.error

ENV = Path("/opt/axecloud/.env")
FOOTER = "Mensagem automática. Não responda."


def load_env():
    env = {}
    for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_templates(waba, ver, token):
    qs = urllib.parse.urlencode({"limit": "100", "fields": "id,name,status,category"})
    req = urllib.request.Request(
        f"https://graph.facebook.com/{ver}/{waba}/message_templates?{qs}"
    )
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as r:
        return {t["name"]: t for t in json.loads(r.read().decode()).get("data", [])}


def edit_template(tpl_id, ver, token, payload):
    url = f"https://graph.facebook.com/{ver}/{tpl_id}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as exc:
        return json.loads(exc.read().decode(errors="ignore") or "{}")


def main():
    e = load_env()
    token = e.get("WA_META_TOKEN") or ""
    waba  = e.get("WA_BUSINESS_ACCOUNT_ID") or ""
    ver   = e.get("WA_BUSINESS_VERSION") or "v21.0"

    templates = fetch_templates(waba, ver, token)
    errors = []

    # ------------------------------------------------------------------ #
    # 1. aviso_portal_conta_axecloud — novo texto + botão URL
    # ------------------------------------------------------------------ #
    name1 = "aviso_portal_conta_axecloud"
    tpl1 = templates.get(name1)
    if not tpl1:
        print(f"[SKIP] {name1} não encontrado")
    else:
        res1 = edit_template(tpl1["id"], ver, token, {
            "components": [
                {
                    "type": "BODY",
                    "text": "Olá, {{1}}! O {{2}} publicou um recado no mural do AxéCloud. Abra o aplicativo para ler.",
                    "example": {"body_text": [["Maria Silva", "Terreiro de Oxum"]]},
                },
                {"type": "FOOTER", "text": FOOTER},
                {
                    "type": "BUTTONS",
                    "buttons": [{
                        "type": "URL",
                        "text": "Abrir o AxéCloud",
                        "url": "https://axecloud.com.br/entrar",
                    }],
                },
            ]
        })
        if res1.get("success") or res1.get("id"):
            print(f"[OK] {name1} atualizado")
        else:
            msg = json.dumps(res1, ensure_ascii=False)
            print(f"[ERRO] {name1}: {msg}")
            errors.append((name1, msg))

    # ------------------------------------------------------------------ #
    # 2. mensalidade_vence_hoje_axecloud — texto neutro, sem mudar categoria
    # ------------------------------------------------------------------ #
    name2 = "mensalidade_vence_hoje_axecloud"
    tpl2 = templates.get(name2)
    if not tpl2:
        print(f"[SKIP] {name2} não encontrado")
    else:
        res2 = edit_template(tpl2["id"], ver, token, {
            "components": [
                {
                    "type": "BODY",
                    "text": (
                        "Olá, {{1}}. Sua contribuição de {{2}} referente a {{3}} vence hoje no {{4}}. "
                        "Acesse o portal para verificar o status do pagamento."
                    ),
                    "example": {
                        "body_text": [
                            ["Maria Silva", "R$ 150,00", "agosto de 2026", "Terreiro de Oxum"]
                        ]
                    },
                },
                {"type": "FOOTER", "text": FOOTER},
            ]
        })
        if res2.get("success") or res2.get("id"):
            print(f"[OK] {name2} atualizado")
        else:
            msg = json.dumps(res2, ensure_ascii=False)
            print(f"[ERRO] {name2}: {msg}")
            errors.append((name2, msg))

    # ------------------------------------------------------------------ #
    # 3. estoque_critico_axecloud — formato resumo (lista de itens)
    # ------------------------------------------------------------------ #
    name3 = "estoque_critico_axecloud"
    tpl3 = templates.get(name3)
    if not tpl3:
        print(f"[SKIP] {name3} não encontrado")
    else:
        novo_texto = (
            "⚠️ Alerta de estoque crítico — {{3}}\n\n"
            "Os seguintes itens estão abaixo do mínimo:\n"
            "{{1}}\n\n"
            "Total: {{2}} item(s) precisam de reposição."
        )
        res3 = edit_template(tpl3["id"], ver, token, {
            "components": [
                {
                    "type": "BODY",
                    "text": novo_texto,
                    "example": {
                        "body_text": [[
                            "• Vela branca: 2 un.\n• Pemba: 0 un.\n• Defumador: 1 un.",
                            "3",
                            "Terreiro de Oxum",
                        ]]
                    },
                },
                {"type": "FOOTER", "text": FOOTER},
            ]
        })
        if res3.get("success") or res3.get("id"):
            print(f"[OK] {name3} atualizado")
        else:
            msg = json.dumps(res3, ensure_ascii=False)
            print(f"[ERRO] {name3}: {msg}")
            errors.append((name3, msg))

    if errors:
        print("\nAinda há erros — verifique se 24h já passaram desde a última edição.")
    else:
        print("\nTodos os templates enviados para re-aprovação da Meta.")


if __name__ == "__main__":
    main()
