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

# Check all whatsapp_logs for Macaia phone (5564981036902) or tenant 14a642ef-a88d-4a10-895c-8d41e0ab61e2
logs = get("whatsapp_logs", {
    "or": "(tenant_id.eq.14a642ef-a88d-4a10-895c-8d41e0ab61e2,telefone.ilike.%981036902%)",
    "order": "created_at.desc",
    "limit": "30"
})
print("MACAIA WA LOGS:", len(logs))
for l in logs:
    msg = (l.get("mensagem") or "").encode("ascii", "replace").decode("ascii")
    print(f"[{l.get('created_at')}] tipo={l.get('tipo')} status={l.get('status')}")
    print(f"  to={l.get('telefone')} template={l.get('template_name')}")
    print(f"  msg: {msg[:200]}")

# Check audit_logs
try:
    audits = get("audit_logs", {
        "or": "(target_id.eq.14a642ef-a88d-4a10-895c-8d41e0ab61e2,tenant_id.eq.14a642ef-a88d-4a10-895c-8d41e0ab61e2)",
        "order": "created_at.desc",
        "limit": "10"
    })
    print("\nAUDIT LOGS:", len(audits))
    for a in audits:
        print(f"[{a.get('created_at')}] {a.get('event_type')}: {a.get('description')}")
except Exception as e:
    print("Audit error:", e)
