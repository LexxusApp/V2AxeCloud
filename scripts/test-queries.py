import json
import urllib.request
from supabase import create_client

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

sb = create_client(url, key)

tenant_id = "4b167a21-d208-4f36-8b97-692f9c8e44a3"

print("--- Testing resolveLeaderId logic ---")
res_leader = sb.table("perfil_lider").select("id, email, tenant_id").or_(f"id.eq.{tenant_id},tenant_id.eq.{tenant_id}").limit(1).execute()
print("perfil_lider:", res_leader.data)

resolved_id = res_leader.data[0]["id"] if res_leader.data else tenant_id
ids = list(set([tenant_id, resolved_id]))
tenant_filters = ",".join([f"tenant_id.eq.{i},lider_id.eq.{i}" for i in ids])
print("tenantFilters:", tenant_filters)

print("\n--- Testing calendario_axe query ---")
try:
    q = sb.table("calendario_axe").select("*").or_(tenant_filters).order("data", desc=False)
    q = q.neq("tipo", "Obrigação")
    q = q.gte("data", "2026-10-10")
    q = q.lte("data", "2026-10-17")
    res_events = q.execute()
    print("calendario_axe success:", len(res_events.data), "items")
except Exception as e:
    print("calendario_axe ERROR:", e)

print("\n--- Testing pedidos_reza query ---")
try:
    q_reza = sb.table("pedidos_reza").select("id, status, nome, telefone, canal, created_at").or_(f"tenant_id.eq.{tenant_id},lider_id.eq.{resolved_id}").execute()
    print("pedidos_reza success:", len(q_reza.data), "items")
except Exception as e:
    print("pedidos_reza ERROR:", e)
