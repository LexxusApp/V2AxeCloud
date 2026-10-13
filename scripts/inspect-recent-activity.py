import json
import urllib.request
import os
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
url = env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

print("=== 1. ÚLTIMOS LOGS EM WHATSAPP_LOGS ===")
try:
    req = urllib.request.Request(f"{url}/rest/v1/whatsapp_logs?select=*&order=created_at.desc&limit=10", headers=headers)
    with urllib.request.urlopen(req) as resp:
        logs = json.loads(resp.read().decode())
        for l in logs:
            msg = str(l.get('mensagem') or '')[:70]
            print(f"[{l.get('created_at')}] {l.get('tipo')} -> {l.get('telefone')} ({l.get('status')}): {msg}")
except Exception as e:
    print("Erro em whatsapp_logs:", e)

print("\n=== 2. ÚLTIMAS ENTREGAS EM WHATSAPP_DELIVERIES ===")
try:
    req = urllib.request.Request(f"{url}/rest/v1/whatsapp_deliveries?select=*&order=created_at.desc&limit=10", headers=headers)
    with urllib.request.urlopen(req) as resp:
        delivs = json.loads(resp.read().decode())
        for d in delivs:
            print(f"[{d.get('created_at')}] {d.get('template_name')} -> {d.get('recipient_phone')} ({d.get('status')}): ext_id={d.get('external_id')}")
except Exception as e:
    print("Erro em whatsapp_deliveries:", e)

print("\n=== 3. ATIVIDADE RECENTE DE PROSPECÇÃO (LEADS) ===")
try:
    req = urllib.request.Request(f"{url}/rest/v1/leads_prospeccao?select=id,nome,telefone,cidade,estado,status,origem,updated_at&order=updated_at.desc&limit=10", headers=headers)
    with urllib.request.urlopen(req) as resp:
        leads = json.loads(resp.read().decode())
        for ld in leads:
            print(f"[{ld.get('updated_at')}] {ld.get('nome')} ({ld.get('telefone')}) | Cidade: {ld.get('cidade')}-{ld.get('estado')} | Status: {ld.get('status')}")
except Exception as e:
    print("Erro em leads_prospeccao:", e)

print("\n=== 4. ÚLTIMOS LOGS DE AUDITORIA (AUDIT_LOGS) ===")
try:
    req = urllib.request.Request(f"{url}/rest/v1/audit_logs?select=*&order=created_at.desc&limit=10", headers=headers)
    with urllib.request.urlopen(req) as resp:
        audits = json.loads(resp.read().decode())
        for a in audits:
            print(f"[{a.get('created_at')}] Ação: {a.get('action') or a.get('tipo')} | User: {a.get('user_id') or a.get('tenant_id')}")
except Exception as e:
    print("Erro em audit_logs:", e)
