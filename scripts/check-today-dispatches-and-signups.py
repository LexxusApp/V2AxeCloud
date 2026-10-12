import json
import urllib.request
import urllib.error
import datetime
import zoneinfo
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
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

sp_tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
now = datetime.datetime.now(sp_tz)
today_str = now.strftime("%Y-%m-%d")

print(f"=== AUDITORIA DE HOJE ({today_str} - {now.strftime('%H:%M:%S')}) ===")

# 1. Checar disparos de hoje no whatsapp_logs
print("\n--- 1. DISPAROS E STATUS NO WHATSAPP_LOGS ---")
req_logs = urllib.request.Request(
    f"{url}/rest/v1/whatsapp_logs?created_at=gte.{today_str}T00:00:00-03:00&order=created_at.desc",
    headers=headers
)
with urllib.request.urlopen(req_logs) as res:
    logs = json.loads(res.read().decode())

print(f"Total de registros de WhatsApp hoje: {len(logs)}")
for l in logs:
    created = l.get("created_at", "")[:19]
    tipo = l.get("tipo", "")
    phone = l.get("telefone", "")
    status = l.get("status", "")
    msg = str(l.get("mensagem", ""))[:65]
    print(f"[{created}] {tipo:<22} | Tel: {phone:<14} | Status: {status:<9} | {msg}")

# 2. Checar se houve alguma resposta / inbound ou clique de resgate
print("\n--- 2. AÇÕES DE RESGATE DETECTADAS (WIN-BACK ACTIONS) ---")
req_winback = urllib.request.Request(
    f"{url}/rest/v1/whatsapp_logs?tipo=ilike.*winback*&created_at=gte.{today_str}T00:00:00-03:00&order=created_at.desc",
    headers=headers
)
with urllib.request.urlopen(req_winback) as res:
    wb_logs = json.loads(res.read().decode())
if wb_logs:
    for w in wb_logs:
        print(f"-> Ação registrada: {w.get('tipo')} para {w.get('telefone')} - {w.get('mensagem')}")
else:
    print("Nenhum clique ou resposta registrado ainda (aguardando interação dos líderes).")

# 3. Checar cadastros de terreiros hoje
print("\n--- 3. NOVOS TERREIROS / USUÁRIOS CADASTRADOS HOJE ---")

# a) perfil_lider
req_perfis = urllib.request.Request(
    f"{url}/rest/v1/perfil_lider?created_at=gte.{today_str}T00:00:00-03:00&order=created_at.desc",
    headers=headers
)
with urllib.request.urlopen(req_perfis) as res:
    perfis_hoje = json.loads(res.read().decode())

print(f"Terreiros cadastrados em perfil_lider hoje: {len(perfis_hoje)}")
for p in perfis_hoje:
    print(f"- Nome: {p.get('nome_terreiro')} | Zelador: {p.get('cargo') or p.get('zelador')} | Email: {p.get('email')} | Fone: {p.get('whatsapp')} | ID: {p.get('id')}")

# b) auth.users via admin
print("\n--- 4. USUÁRIOS CRIADOS EM AUTH.USERS HOJE / ÚLTIMOS DIAS ---")
req_users = urllib.request.Request(
    f"{url}/auth/v1/admin/users?page=1&per_page=20",
    headers=headers
)
try:
    with urllib.request.urlopen(req_users) as res:
        users_data = json.loads(res.read().decode())
        users = users_data.get("users", [])
        
        users_hoje = [u for u in users if u.get("created_at", "").startswith(today_str)]
        print(f"Contas criadas hoje em auth.users: {len(users_hoje)}")
        for u in users_hoje:
            meta = u.get("user_metadata", {})
            print(f"- Email: {u.get('email')} | Criado: {u.get('created_at')} | Nome: {meta.get('nome_terreiro') or meta.get('nome_zelador')} | Fone: {meta.get('whatsapp')}")
            
        # Também listar os últimos 5 cadastros para ver quando foi o mais recente
        print("\nÚltimos 5 cadastros gerais no sistema:")
        for u in users[:5]:
            meta = u.get("user_metadata", {})
            c_at = u.get("created_at", "")[:19]
            print(f"- [{c_at}] {u.get('email')} | Terreiro: {meta.get('nome_terreiro') or 'N/A'} | Fone: {meta.get('whatsapp') or 'N/A'}")
except Exception as e:
    print(f"Erro ao listar auth.users: {e}")
