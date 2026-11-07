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

tenant_id = "4b167a21-d208-4f36-8b97-692f9c8e44a3"
req_tenant = urllib.request.Request(
    f"{url}/rest/v1/tenants?id=eq.{tenant_id}",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req_tenant) as resp:
    data = json.loads(resp.read().decode())
    print("Tenant Data:", json.dumps(data, indent=2, ensure_ascii=False))

# Also query profiles for this tenant
req_profiles = urllib.request.Request(
    f"{url}/rest/v1/profiles?tenant_id=eq.{tenant_id}",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req_profiles) as resp:
    data = json.loads(resp.read().decode())
    print("Profiles Data:", json.dumps(data, indent=2, ensure_ascii=False))
