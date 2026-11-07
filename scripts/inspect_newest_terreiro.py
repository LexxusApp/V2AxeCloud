import urllib.request
import json

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
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

print("=== ÚLTIMOS PERFIS DE LÍDER / TERREIRO CADASTRADOS ===")
req = urllib.request.Request(f"{sb_url}/rest/v1/perfil_lider?order=created_at.desc&limit=10", headers=headers)
with urllib.request.urlopen(req) as resp:
    leaders = json.loads(resp.read().decode())
    for l in leaders:
        print(f"[{l.get('created_at')}] ID: {l.get('id')} | Terreiro: '{l.get('nome_terreiro')}' | Cargo/Nome: '{l.get('cargo')}' | Email: {l.get('email')} | Tel: {l.get('whatsapp') or l.get('whatsapp_publico')}")

print("\n=== ÚLTIMOS USUÁRIOS NO AUTH.USERS ===")
req_u = urllib.request.Request(f"{sb_url}/auth/v1/admin/users?per_page=10", headers=headers)
with urllib.request.urlopen(req_u) as resp:
    users = json.loads(resp.read().decode()).get("users", [])
    users.sort(key=lambda u: u.get("created_at") or "", reverse=True)
    for u in users[:10]:
        print(f"[{u.get('created_at')}] ID: {u.get('id')} | Email: {u.get('email')} | Confirmed: {u.get('email_confirmed_at')}")
