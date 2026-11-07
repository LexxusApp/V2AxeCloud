import urllib.request
import json
import sys
from datetime import datetime

# Configure stdout for utf-8 on Windows
sys.stdout.reconfigure(encoding='utf-8')

def load_env(path="c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env"):
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
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

print("=== 1. ÚLTIMAS MENSAGENS NO WHATSAPP (INBOUND / OUTBOUND) ===")
try:
    req = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages?order=created_at.desc&limit=15", headers=headers)
    with urllib.request.urlopen(req) as r:
        msgs = json.loads(r.read().decode())
        for m in msgs:
            dt = m.get("created_at")
            direction = m.get("direction")
            phone = m.get("phone") or m.get("from_number")
            body = (m.get("body") or m.get("message") or "")[:120].replace("\n", " ")
            lead_id = m.get("lead_id")
            print(f"[{dt}] {str(direction).upper()} ({phone}) [lead: {lead_id}]: {body}")
except Exception as e:
    print("Erro msgs:", e)

print("\n=== 2. DETALHES DOS NOVOS CADASTROS HOJE (perfil_lider) ===")
try:
    req = urllib.request.Request(f"{sb_url}/rest/v1/perfil_lider?order=created_at.desc&limit=8", headers=headers)
    with urllib.request.urlopen(req) as r:
        leads = json.loads(r.read().decode())
        for l in leads:
            print(f"- ID: {l.get('id')}")
            print(f"  Nome: {l.get('nome_terreiro')} | Dirigente: {l.get('cargo')}")
            print(f"  Email: {l.get('email')} | Tel: {l.get('whatsapp')} | Pub: {l.get('whatsapp_publico')}")
            print(f"  Criado em: {l.get('created_at')}")
except Exception as e:
    print("Erro leads:", e)

print("\n=== 3. STATUS PAI CRISTIAN (URANDI) ===")
try:
    req = urllib.request.Request(f"{sb_url}/rest/v1/subscriptions?id=eq.3b0bac5d-93fd-4612-a0ef-00f41104593b", headers=headers)
    with urllib.request.urlopen(req) as r:
        subs = json.loads(r.read().decode())
        for s in subs:
            print(f"Status: {s.get('status')} | Expira: {s.get('expires_at')} | TxID: {s.get('efi_pix_txid')} | Updated: {s.get('updated_at')}")
except Exception as e:
    print("Erro Pai Cristian:", e)

print("\n=== 4. AUDIT LOGS RECENTES (ÚLTIMAS HORAS) ===")
try:
    req = urllib.request.Request(f"{sb_url}/rest/v1/audit_logs?order=created_at.desc&limit=10", headers=headers)
    with urllib.request.urlopen(req) as r:
        logs = json.loads(r.read().decode())
        for al in logs:
            print(f"[{al.get('created_at')}] Ação: {al.get('action')} | Tenant: {al.get('tenant_id')} | User: {al.get('user_id')}")
except Exception as e:
    print("Erro audit_logs:", e)

