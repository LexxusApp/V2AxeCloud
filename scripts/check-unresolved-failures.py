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
url = f"{sb_url}/rest/v1/tenant_feature_failures?resolved_at=is.null&select=*&order=created_at.desc&limit=20"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(f"Total unresolved failures: {len(data)}")
    for row in data:
        print(f"ID: {row.get('id')} | Tenant: {row.get('tenant_id')} | Feature: {row.get('feature')} | Route: {row.get('route')} | Error: {row.get('error_message')} | Created: {row.get('created_at')}")
