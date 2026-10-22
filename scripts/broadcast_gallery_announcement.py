#!/usr/bin/env python3
"""Dispara o comunicado oficial de 100 GB de Galeria no Backblaze para todos os zeladores."""
import json
import time
import urllib.request
import urllib.error
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env(path=".env"):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env()
token = env.get("WA_META_TOKEN")
phone_id = env.get("WA_PHONE_NUMBER_ID")
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
TEMPLATE_NAME = "galeria_memoria_100gb_axecloud"

headers_sb = {
    "apikey": sb_key,
    "Authorization": f"Bearer {sb_key}",
    "Content-Type": "application/json"
}

def normalize_phone(phone_str):
    if not phone_str:
        return None
    digits = "".join(c for c in phone_str if c.isdigit())
    if len(digits) == 10:  # DDD + 8
        digits = digits[:2] + "9" + digits[2:]
    if len(digits) == 11 and not digits.startswith("55"):
        digits = "55" + digits
    if len(digits) == 13 and digits.startswith("55"):
        return digits
    return digits if len(digits) >= 12 else None

def send_template(phone, nome_zelador, nome_terreiro):
    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": TEMPLATE_NAME,
            "language": {"code": "pt_BR"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(nome_zelador or "Zelador").strip()[:60]},
                        {"type": "text", "text": str(nome_terreiro or "Terreiro").strip()[:80]}
                    ]
                }
            ]
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return True, data.get("messages", [{}])[0].get("id")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="ignore")
        return False, f"{e.code} - {err}"
    except Exception as e:
        return False, str(e)

def log_whatsapp(tenant_id, phone, msg_id, status, error=None):
    url = f"{sb_url}/rest/v1/whatsapp_logs"
    body = {
        "tenant_id": tenant_id,
        "telefone": phone,
        "tipo": "aviso_galeria_100gb",
        "mensagem": f"Template: {TEMPLATE_NAME} | Status: {status} | Error: {error or 'None'}",
        "status": status,
        "meta_message_id": msg_id
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers_sb)
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"Erro ao salvar log: {e}", file=sys.stderr)

def main(dry_run=True):
    print(f"=== INICIANDO COMUNICADO GALERIA 100 GB (dry_run={dry_run}) ===")
    req = urllib.request.Request(
        f"{sb_url}/rest/v1/perfil_lider?select=id,cargo,nome_terreiro,email,whatsapp,whatsapp_publico,is_blocked,deleted_at",
        headers=headers_sb
    )
    with urllib.request.urlopen(req) as resp:
        leaders = json.loads(resp.read().decode("utf-8"))

    sent_count = 0
    skipped_count = 0
    error_count = 0

    seen_phones = set()

    for leader in leaders:
        if leader.get("deleted_at"):
            skipped_count += 1
            continue

        raw_phone = leader.get("whatsapp") or leader.get("whatsapp_publico")
        phone = normalize_phone(raw_phone)
        if not phone or phone in seen_phones:
            skipped_count += 1
            continue
        seen_phones.add(phone)

        cargo = str(leader.get("cargo") or "Zelador(a)").strip()
        nome_terreiro = str(leader.get("nome_terreiro") or "Terreiro").strip()
        tenant_id = leader.get("id")

        if dry_run:
            print(f"[DRY-RUN] Enviaria para: {cargo} | {nome_terreiro} | Tel: {phone}")
            sent_count += 1
        else:
            ok, res = send_template(phone, cargo, nome_terreiro)
            if ok:
                print(f"[ENVIADO] {cargo} ({nome_terreiro}) -> {phone} [MsgID: {res}]")
                log_whatsapp(tenant_id, phone, res, "sent")
                sent_count += 1
            else:
                print(f"[ERRO] {cargo} ({nome_terreiro}) -> {phone} [Erro: {res}]")
                log_whatsapp(tenant_id, phone, None, "failed", error=str(res))
                error_count += 1
            time.sleep(0.5)  # Respeita o rate limit da Meta Cloud API

    print(f"\n=== RESUMO: Enviados: {sent_count} | Pulados: {skipped_count} | Erros: {error_count} ===")

if __name__ == "__main__":
    is_dry = "--live" not in sys.argv
    main(dry_run=is_dry)
