import urllib.request
import json

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

headers = {
    "apikey": env["SUPABASE_SERVICE_ROLE_KEY"],
    "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}"
}

sb_url = env["VITE_SUPABASE_URL"]
url = f"{sb_url}/rest/v1/tenant_feature_failures?id=in.(56ba2c7d-3ff4-4a13-9a72-3c2970aa28d2,ae17827a-da0f-47d0-930a-6d541032a8a2)&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(json.dumps(data, indent=2, ensure_ascii=False))
