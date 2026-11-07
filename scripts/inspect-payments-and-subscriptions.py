import json
import urllib.request
import sys
import datetime

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

print("=== 1. VERIFICANDO ASSINATURAS RECENTES (SUBSCRIPTIONS) ===")
req_s = urllib.request.Request(f"{url}/rest/v1/subscriptions?order=updated_at.desc&limit=25", headers=headers)
with urllib.request.urlopen(req_s) as res:
    subs = json.loads(res.read().decode())

for s in subs:
    sid = s.get("id")
    # Buscar nome do terreiro em perfil_lider
    req_p = urllib.request.Request(f"{url}/rest/v1/perfil_lider?id=eq.{sid}&select=zelador,nome_terreiro,whatsapp,email,is_blocked,access_block_reason", headers=headers)
    with urllib.request.urlopen(req_p) as resp:
        plist = json.loads(resp.read().decode())
    pinfo = plist[0] if plist else {}
    print(f"ID: {sid} | Casa: {pinfo.get('nome_terreiro')} ({pinfo.get('zelador')}) | Tel: {pinfo.get('whatsapp')} | Email: {pinfo.get('email')}")
    print(f"   Status: {s.get('status')} | Expira: {s.get('expires_at')} | Bloqueado: {pinfo.get('is_blocked')} ({pinfo.get('access_block_reason')}) | Charge: {s.get('efi_charge_id')}")

print("\n=== 2. VERIFICANDO COBRANÇAS EFI / HISTÓRICO PIX ===")
req_c = urllib.request.Request(f"{url}/rest/v1/cobrancas_assinatura?order=created_at.desc&limit=10", headers=headers)
try:
    with urllib.request.urlopen(req_c) as resc:
        charges = json.loads(resc.read().decode())
    print(f"Total em cobrancas_assinatura: {len(charges)}")
    for c in charges:
        print(f"[{c.get('created_at')[:19]}] ID: {c.get('id')} | Tenant: {c.get('tenant_id')} | Valor: {c.get('valor')} | Status: {c.get('status')} | TXID: {c.get('txid')}")
except Exception as e:
    print("Erro em cobrancas_assinatura:", e)

# Verificar se há outras tabelas de cobrança/pix
for tbl in ["efi_pix_cobrancas", "pagamentos_assinatura", "efi_tokens"]:
    try:
        req_x = urllib.request.Request(f"{url}/rest/v1/{tbl}?limit=3", headers=headers)
        with urllib.request.urlopen(req_x) as resx:
            print(f"Tabela {tbl} existe! Linhas: {len(json.loads(resx.read().decode()))}")
    except Exception:
        pass
