import urllib.request
import json
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

def query(endpoint):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("=== 1. BUSCANDO MENSAGENS PARA O NÚMERO DO LUCAS (11920033501) EM WHATSAPP_LOGS ===")
try:
    logs = query("whatsapp_logs?telefone=ilike.*11920033501*&order=created_at.desc&limit=15")
    for l in logs:
        print(f"[{l.get('created_at')}] Tipo: {l.get('tipo')} | Status: {l.get('status')} | Msg: {l.get('mensagem')}")
except Exception as e:
    print(f"Erro whatsapp_logs: {e}")

print("\n=== 2. EVENTOS DE 04:04 DA MADRUGADA (OYEKUNDI) ===")
try:
    wa_madrugada = query("whatsapp_logs?created_at=gte.2026-10-14T03:55:00Z&created_at=lte.2026-10-14T04:15:00Z&order=created_at.desc")
    for w in wa_madrugada:
        print(f"[{w.get('created_at')}] Tel: {w.get('telefone')} | Tipo: {w.get('tipo')} | Status: {w.get('status')} | Msg: {w.get('mensagem')}")
except Exception as e:
    print(f"Erro wa_madrugada: {e}")

print("\n=== 3. AUDIT_LOGS DA MADRUGADA ===")
try:
    audits = query("audit_logs?created_at=gte.2026-10-14T03:55:00Z&created_at=lte.2026-10-14T04:15:00Z&order=created_at.desc")
    for a in audits:
        print(f"[{a.get('created_at')}] Action: {a.get('action')} | User: {a.get('user_email')} | Meta: {json.dumps(a.get('metadata') or {})}")
except Exception as e:
    print(f"Erro audit_logs: {e}")
