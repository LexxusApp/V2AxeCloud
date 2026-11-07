import json
import urllib.request
from pathlib import Path
from urllib.parse import urlencode

def load_env():
    env = {}
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")

def get(table, params):
    q = urlencode(params, safe="(),.*:")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/{table}?{q}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

tenant_id = "3b0bac5d-93fd-4612-a0ef-00f41104593b"
sub = get("subscriptions", {"id": f"eq.{tenant_id}"})
p = get("perfil_lider", {"id": f"eq.{tenant_id}"})
print("p.whatsapp:", p[0].get("whatsapp"), "p.whatsapp_publico:", p[0].get("whatsapp_publico"))
print("sub.billing_cycle:", sub[0].get("billing_cycle"))
print("sub.status:", sub[0].get("status"))
