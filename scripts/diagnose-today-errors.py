import json
import urllib.request
import sys
import datetime
import zoneinfo

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
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

sp_tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
now = datetime.datetime.now(sp_tz)
print(f"=== DIAGNÓSTICO DE ERROS DE HOJE ({now.strftime('%d/%m/%Y %H:%M:%S')}) ===")

# 1. Feature Failures hoje
print("\n--- 1. FEATURE_FAILURES HOJE (13/10) ---")
try:
    req = urllib.request.Request(
        f"{url}/rest/v1/feature_failures?created_at=gte.2026-10-13T00:00:00Z&order=created_at.desc&limit=50",
        headers=headers
    )
    with urllib.request.urlopen(req) as res:
        fails = json.loads(res.read().decode())
    print(f"Total de falhas hoje em feature_failures: {len(fails)}")
    for f in fails:
        print(f"[{str(f.get('created_at'))[:19]}] Feature: {f.get('feature_name')} | Status: {f.get('status')} | Tentativas: {f.get('retry_count')}")
        print(f"  Erro: {f.get('error_message')}")
        print(f"  Detalhes: {f.get('error_details')}")
        print(f"  Tenant/Context: {f.get('tenant_id')} / {f.get('context')}\n")
except Exception as e:
    print("Erro ao consultar feature_failures:", e)

# 2. Novas mensagens no WhatsApp Admin hoje
print("\n--- 2. MENSAGENS NO WHATSAPP ADMIN HOJE (13/10) ---")
try:
    req_m = urllib.request.Request(
        f"{url}/rest/v1/admin_whatsapp_messages?created_at=gte.2026-10-13T00:00:00Z&order=created_at.desc&limit=30",
        headers=headers
    )
    with urllib.request.urlopen(req_m) as res:
        msgs = json.loads(res.read().decode())
    print(f"Total de mensagens trocadas hoje: {len(msgs)}")
    for m in msgs:
        d = "⬅️ INBOUND" if m.get("direction") == "inbound" else "➡️ OUTBOUND"
        print(f"[{str(m.get('created_at'))[:19]}] {d} (Status: {m.get('status')}): {m.get('body')}")
except Exception as e:
    print("Erro ao consultar mensagens:", e)

# 3. Novos terreiros cadastrados hoje ou últimos
print("\n--- 3. TERREIROS CADASTRADOS RECENTEMENTE ---")
try:
    req_t = urllib.request.Request(
        f"{url}/rest/v1/perfil_lider?order=created_at.desc&limit=10",
        headers=headers
    )
    with urllib.request.urlopen(req_t) as res:
        liders = json.loads(res.read().decode())
    print(f"Últimos {len(liders)} líderes cadastrados:")
    for l in liders:
        print(f"[{str(l.get('created_at'))[:19]}] Líder: {l.get('nome')} | Casa: {l.get('nome_terreiro')} | Tel: {l.get('whatsapp')} | Email: {l.get('email')}")
except Exception as e:
    print("Erro ao consultar perfil_lider:", e)

# 4. Falhas em pagamentos / mensalidades hoje
print("\n--- 4. MENSALIDADES / PAGAMENTOS HOJE ---")
try:
    req_pay = urllib.request.Request(
        f"{url}/rest/v1/mensalidades?updated_at=gte.2026-10-13T00:00:00Z&order=updated_at.desc&limit=20",
        headers=headers
    )
    with urllib.request.urlopen(req_pay) as res:
        pays = json.loads(res.read().decode())
    print(f"Mensalidades atualizadas hoje: {len(pays)}")
    for p in pays:
        print(f"[{str(p.get('updated_at'))[:19]}] ID: {p.get('id')} | Valor: {p.get('valor')} | Status: {p.get('status')} | Pix TXID: {p.get('pix_txid')}")
except Exception as e:
    print("Erro ao consultar mensalidades:", e)

# 5. Assinaturas de terreiros / assinaturas_plano
print("\n--- 5. ASSINATURAS DOS TERREIROS HOJE ---")
try:
    req_sub = urllib.request.Request(
        f"{url}/rest/v1/assinaturas_plano?updated_at=gte.2026-10-13T00:00:00Z&order=updated_at.desc&limit=10",
        headers=headers
    )
    with urllib.request.urlopen(req_sub) as res:
        subs = json.loads(res.read().decode())
    print(f"Assinaturas atualizadas hoje: {len(subs)}")
    for s in subs:
        print(f"[{str(s.get('updated_at'))[:19]}] ID: {s.get('id')} | Status: {s.get('status')} | Tenant: {s.get('tenant_id')}")
except Exception as e:
    print("Erro ao consultar assinaturas_plano:", e)
