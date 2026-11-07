import urllib.request
import json

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

sb_url = env["VITE_SUPABASE_URL"]
sb_key = env["SUPABASE_SERVICE_ROLE_KEY"]
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

joyce_id = "5de04732-9419-4ef5-8558-7287ed140e79"

print("=== 1. PERFIL LIDER ===")
url_p = f"{sb_url}/rest/v1/perfil_lider?id=eq.{joyce_id}&select=*"
req = urllib.request.Request(url_p, headers=headers)
with urllib.request.urlopen(req) as resp:
    perfil = json.loads(resp.read().decode())
    print(json.dumps(perfil, indent=2, ensure_ascii=False))

print("\n=== 2. SUBSCRIPTION ===")
url_s = f"{sb_url}/rest/v1/subscriptions?id=eq.{joyce_id}&select=*"
req = urllib.request.Request(url_s, headers=headers)
with urllib.request.urlopen(req) as resp:
    sub = json.loads(resp.read().decode())
    print(json.dumps(sub, indent=2, ensure_ascii=False))

# Check Auth User (last_sign_in_at)
user_id = perfil[0].get("user_id") if perfil and perfil[0].get("user_id") else joyce_id
print(f"\n=== 3. AUTH USER (User ID: {user_id}) ===")
url_u = f"{sb_url}/auth/v1/admin/users/{user_id}"
req = urllib.request.Request(url_u, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        u_data = json.loads(resp.read().decode())
        print(f"Email: {u_data.get('email')}")
        print(f"Last Sign In: {u_data.get('last_sign_in_at')}")
        print(f"Created At: {u_data.get('created_at')}")
        print(f"Email Confirmed At: {u_data.get('email_confirmed_at')}")
        print(f"Banned Until: {u_data.get('banned_until')}")
except Exception as e:
    print(f"Auth Admin Error: {e}")

print("\n=== 4. AUDIT LOGS OU TELEMETRIA RECENTE DE JOYCE ===")
url_fail = f"{sb_url}/rest/v1/tenant_feature_failures?tenant_id=eq.{joyce_id}&select=*&order=created_at.desc&limit=5"
req = urllib.request.Request(url_fail, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        fails = json.loads(resp.read().decode())
        print(f"Tenant Failures recentes: {len(fails)}")
        for f in fails:
            print(f"  • [{f.get('created_at')}] Route: {f.get('route')} | Feature: {f.get('feature')} | Msg: {f.get('error_message')}")
except Exception as e:
    print(f"Failures Error: {e}")

print("\n=== 5. MENSAGENS NO WHATSAPP PARA/DE JOYCE ===")
phone = "5511915128744"
url_wa = f"{sb_url}/rest/v1/whatsapp_logs?telefone=eq.{phone}&select=*&order=created_at.desc&limit=5"
req = urllib.request.Request(url_wa, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        w_logs = json.loads(resp.read().decode())
        print(f"Logs de WhatsApp (para {phone}): {len(w_logs)}")
        for w in w_logs:
            print(f"  • [{w.get('created_at')}] Tipo: {w.get('tipo')} | Status: {w.get('status')} | Msg: {w.get('mensagem')[:100]}")
except Exception as e:
    print(f"WA Logs Error: {e}")

print("\n=== 6. FILHOS E DADOS DO TERREIRO DA JOYCE ===")
url_filhos = f"{sb_url}/rest/v1/filhos_de_santo?tenant_id=eq.{joyce_id}&select=id,nome,cargo&limit=5"
req = urllib.request.Request(url_filhos, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        filhos = json.loads(resp.read().decode())
        print(f"Total filhos amostra: {len(filhos)}")
        for f in filhos:
            print(f"  • {f.get('nome')} ({f.get('cargo')})")
except Exception as e:
    print(f"Filhos Error: {e}")


