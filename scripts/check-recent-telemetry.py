import urllib.request
import json
from datetime import datetime, timezone, timedelta

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
import urllib.parse
since = urllib.parse.quote((datetime.now(timezone.utc) - timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%SZ'))
url = f"{sb_url}/rest/v1/tenant_feature_failures?created_at=gte.{since}&select=*&order=created_at.desc"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(f"Total failures in last 2 hours: {len(data)}")
    for d in data:
        print(f"ID: {d.get('id')} | Created: {d.get('created_at')} | Tenant: {d.get('tenant_id')} | Route: {d.get('route')} | Error: {d.get('error_message')} | Resolved: {d.get('resolved_at')}")
