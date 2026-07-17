#!/usr/bin/env python3
"""Upsert WA_META_TEMPLATE_* no .env da VPS (sem imprimir segredos)."""
from pathlib import Path

ENV_PATH = Path("/opt/axecloud/.env")

NEED = {
    "WA_META_TEMPLATE_DADOS_ACESSO": "conta_ativa_axecloud",
    "WA_META_TEMPLATE_FINANCEIRO": "financeiro_axecloud",
    "WA_META_TEMPLATE_COBRANCA_MENSALIDADE": "cobranca_mensalidade_axecloud",
    "WA_META_TEMPLATE_MENSALIDADE_CONFIRMADA": "mensalidade_confirmada_axecloud",
    "WA_META_TEMPLATE_AVISO_GIRA": "aviso_gira_axecloud",
    "WA_META_TEMPLATE_CONVITE_EVENTO": "convite_evento_axecloud",
    "WA_META_TEMPLATE_ESTOQUE_CRITICO": "estoque_critico_axecloud",
    "WA_META_TEMPLATE_TRANSMISSAO_AVISO": "aviso_portal_axecloud",
    "WA_META_TEMPLATE_BROADCAST": "aviso_portal_axecloud",
    "WA_META_TEMPLATE_PEDIDO_REZA_NOVO_ZELADOR": "pedido_reza_novo_zelador_axecloud",
    "WA_META_TEMPLATE_PEDIDO_REZA_ACEITO_FIEL": "pedido_reza_aceito_fiel_axecloud",
    "WA_META_TEMPLATE_LANGUAGE": "pt_BR",
    "WA_META_EVENT_DEFAULT_BANNER_URL": "https://axecloud.com.br/og-image.png",
    "WA_BUSINESS_VERSION": "v21.0",
}


def main() -> None:
    text = ENV_PATH.read_text(errors="ignore")
    env: dict[str, str] = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")

    changed: list[str] = []
    for key, value in NEED.items():
        if env.get(key) == value:
            continue
        changed.append(key)
        env[key] = value

    out: list[str] = []
    seen: set[str] = set()
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        key = line.split("=", 1)[0].strip()
        if key in NEED:
            out.append(f"{key}={env[key]}")
            seen.add(key)
        else:
            out.append(line)
            seen.add(key)

    for key, value in NEED.items():
        if key not in seen:
            out.append(f"{key}={value}")

    ENV_PATH.write_text("\n".join(out) + "\n")
    has_token = bool(env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN"))
    has_phone = bool(env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID"))
    print(f"META_TOKEN={'SET' if has_token else 'MISSING'}")
    print(f"PHONE_ID={'SET' if has_phone else 'MISSING'}")
    print(f"UPDATED={len(changed)}")
    if changed:
        print("KEYS=" + ",".join(changed))


if __name__ == "__main__":
    main()
