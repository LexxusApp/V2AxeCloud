#!/usr/bin/env python3
"""Dispara a campanha de resgate (Win-Back) com botões para os terreiros bloqueados."""
import json
import urllib.request
import urllib.error
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ENV_PATH = ".env"

def load_env(path: str) -> dict[str, str]:
    env = {}
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env

env = load_env(ENV_PATH)
token = env.get("WA_META_TOKEN") or env.get("META_WHATSAPP_ACCESS_TOKEN")
phone_number_id = env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID")

if not token or not phone_number_id:
    print(f"Erro: credenciais Meta ausentes token={bool(token)} phone_id={bool(phone_number_id)}")
    sys.exit(1)

def send_template(phone: str, template_name: str, nome_zelador: str, nome_terreiro: str):
    clean_phone = "".join(filter(str.isdigit, phone))
    if len(clean_phone) == 10 or len(clean_phone) == 11:
        clean_phone = "55" + clean_phone
    
    url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "pt_BR"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(nome_zelador or "Zelador(a)").strip()},
                        {"type": "text", "text": str(nome_terreiro or "Terreiro").strip()}
                    ]
                }
            ]
        }
    }
    
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            res_body = json.loads(res.read().decode("utf-8"))
            return True, res_body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        return False, raw

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    target_phone = sys.argv[2] if len(sys.argv) > 2 else None

    # Lista dos terreiros bloqueados auditados na base:
    leads = [
        {
            "id": "14a642ef-a88d-4a10-895c-8d41e0ab61e2",
            "terreiro": "Templo Reino da Macaia - T.R.I.M",
            "zelador": "Pai Jesuema",
            "phone": "5564981036902",
            "has_children": True, # 10 filhos
            "template": "resgate_com_filhos_axecloud"
        },
        {
            "id": "babd181f-40d0-44bb-8eae-40f2cee0b54e",
            "terreiro": "YLÊ EXU TIRIRI LONAN",
            "zelador": "Alex d'Odé",
            "phone": "5554996629777",
            "has_children": True, # 5 filhos
            "template": "resgate_com_filhos_axecloud"
        },
        {
            "id": "dabc954f-2f90-4c2e-b235-35569c145059",
            "terreiro": "Iledi Èṣúdèyí",
            "zelador": "Guilherme Alves",
            "phone": "5546999108531",
            "has_children": True, # 1 filho
            "template": "resgate_com_filhos_axecloud"
        },
        {
            "id": "8b3caf8b-83a7-4262-926b-42f7b92c6ad0",
            "terreiro": "Terreiro de Umbanda Xangô Agodô Axé Casa Velha",
            "zelador": "Mailson Ricelli",
            "phone": "5561999073429",
            "has_children": False, # 0 filhos
            "template": "resgate_sem_filhos_axecloud"
        },
        {
            "id": "8a7f4029-980c-4c2a-8db3-f252c6b526aa",
            "terreiro": "TEMPLO DE KIMBANDA IMPÉRIO DE MARIA PADILHA",
            "zelador": "Mãe Danny da Padilha",
            "phone": "5541991699375",
            "has_children": False, # 0 filhos
            "template": "resgate_sem_filhos_axecloud"
        },
        {
            "id": "009a518e-cae2-40ac-bf90-df6f754a56f2",
            "terreiro": "E.U.J.A(Espaço Universalista Dr. José De Arimateia)",
            "zelador": "Lucas Ramos",
            "phone": "5515996959720",
            "has_children": False, # 0 filhos
            "template": "resgate_sem_filhos_axecloud"
        }
    ]

    print(f"=== CAMPANHA DE RESGATE AXÉCLOUD (WIN-BACK) ===")
    print(f"Modo: {mode}")

    if mode == "preview":
        for l in leads:
            botoes = "[ 50% de Desconto ] [ 15 Dias + 50% ]" if l["has_children"] else "[ + 15 Dias ]"
            print(f"- {l['terreiro']} ({l['zelador']}) -> Fone: {l['phone']} | Template: {l['template']} | Botões: {botoes}")
        print("\nPara disparar teste no seu número: python scripts/send-winback-campaign.py test <seu_numero>")
        print("Para disparar para todos os leads: python scripts/send-winback-campaign.py send_all")
    elif mode == "test" and target_phone:
        print(f"Disparando teste do template COM FILHOS para {target_phone}...")
        ok, res = send_template(target_phone, "resgate_com_filhos_axecloud", "Lucas", "Terreiro de Teste")
        print("Resultado COM FILHOS:", ok, res)
        print(f"Disparando teste do template SEM FILHOS para {target_phone}...")
        ok2, res2 = send_template(target_phone, "resgate_sem_filhos_axecloud", "Lucas", "Terreiro de Teste")
        print("Resultado SEM FILHOS:", ok2, res2)
    elif mode == "send_all":
        import time
        sb_url = env.get("VITE_SUPABASE_URL")
        sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

        for l in leads:
            print(f"\nEnviando para {l['terreiro']} ({l['phone']})...")
            ok, res = send_template(l["phone"], l["template"], l["zelador"], l["terreiro"])
            print("Resultado:", ok, res)

            if ok and sb_url and sb_key:
                try:
                    log_payload = {
                        "tenant_id": l["id"],
                        "tipo": "campanha_resgate",
                        "telefone": l["phone"],
                        "mensagem": f"Template de resgate {l['template']} enviado para {l['zelador']} ({l['terreiro']}).",
                        "status": "delivered"
                    }
                    req_log = urllib.request.Request(
                        f"{sb_url}/rest/v1/whatsapp_logs",
                        data=json.dumps(log_payload).encode("utf-8"),
                        headers={
                            "apikey": sb_key,
                            "Authorization": f"Bearer {sb_key}",
                            "Content-Type": "application/json"
                        },
                        method="POST"
                    )
                    with urllib.request.urlopen(req_log) as l_resp:
                        print(f"Log gravado para {l['terreiro']}.")
                except Exception as log_err:
                    print("Erro ao gravar log:", log_err)

            time.sleep(1)
