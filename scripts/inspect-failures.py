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

endpoint = f"{url}/rest/v1/tenant_feature_failures?select=*&order=created_at.desc&limit=10"
req = urllib.request.Request(
    endpoint,
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(json.dumps(data, indent=2, ensure_ascii=False))
