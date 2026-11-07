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
print("Sub:", sub)

# Check if there is any log with cobranca_assinatura for Urandi
logs = get("whatsapp_logs", {"tenant_id": f"eq.{tenant_id}", "tipo": "eq.cobranca_assinatura"})
print("cobranca_assinatura logs:", logs)

# Check EFI env vars
print("EFI_CLIENT_ID exists:", bool(env.get("EFI_CLIENT_ID")))
print("EFI_PIX_KEY exists:", bool(env.get("EFI_PIX_KEY")))
print("WA_PHONE_NUMBER_ID exists:", bool(env.get("WA_PHONE_NUMBER_ID") or env.get("META_WHATSAPP_PHONE_NUMBER_ID")))

# Check if the cron runs on cloudflare container or prospect worker
