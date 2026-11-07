import json
import urllib.request

def load_env(path):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env(".env")
url = env["VITE_SUPABASE_URL"]
key = env["SUPABASE_SERVICE_ROLE_KEY"]
tid = "4b167a21-d208-4f36-8b97-692f9c8e44a3"

for table in ["perfil_lider", "filhos_de_santo"]:
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?or=(id.eq.{tid},tenant_id.eq.{tid})",
        headers={"apikey": key, "Authorization": f"Bearer {key}"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"--- Table: {table} ({len(data)} rows) ---")
        for r in data:
            print("ID:", r.get("id"), "Tenant:", r.get("tenant_id"), "Nome:", r.get("nome") or r.get("nome_terreiro"), "Email:", r.get("email"))
