import sys
import json
import urllib.request
import urllib.error

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
anon_key = env.get("VITE_SUPABASE_ANON_KEY")

user_id = "7438e2e0-972f-47d8-afa4-45f33d3c8fab"
email = "valdetygarciapolicarpo97@gmail.com"
new_password = "Axe" + "2026@77!" # Axe2026@77!

print(f"Atualizando senha de {email} (ID: {user_id}) para '{new_password}'...")

# 1. Update user via Supabase Admin API
req_update = urllib.request.Request(
    f"{url}/auth/v1/admin/users/{user_id}",
    data=json.dumps({"password": new_password, "email_confirm": True}).encode("utf-8"),
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    method="PUT"
)

try:
    with urllib.request.urlopen(req_update) as resp:
        res = json.loads(resp.read().decode())
        print("✅ Senha atualizada no Supabase Auth com sucesso!")
except Exception as e:
    print(f"❌ Erro ao atualizar senha: {e}")

# 2. Testar autenticação real com a nova senha
print("\nTestando login com a nova senha...")
req_login = urllib.request.Request(
    f"{url}/auth/v1/token?grant_type=password",
    data=json.dumps({"email": email, "password": new_password}).encode("utf-8"),
    headers={"apikey": anon_key, "Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req_login) as resp:
        tok = json.loads(resp.read().decode())
        print(f"✅ Login testado com SUCESSO! Access Token emitido: {tok.get('access_token')[:25]}...")
except Exception as e:
    print(f"❌ Falha no teste de login: {e}")
