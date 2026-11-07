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
tenant_id = "968ae2d1-e32d-454d-9b30-05543843d8ab"

print("--- Testing calendario_axe query ---")
# query = supabaseAdmin.from('calendario_axe').select('*').order('data', { ascending: true })
# query = query.or(tenantFilters)
url_cal = f"{sb_url}/rest/v1/calendario_axe?or=(tenant_id.eq.{tenant_id},lider_id.eq.{tenant_id})&order=data.asc&limit=10"
try:
    req = urllib.request.Request(url_cal, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"calendario_axe OK: {len(data)} rows")
        for row in data:
            print(f"  • Evento: {row.get('titulo')} | Data: {row.get('data')} | Tipo: {row.get('tipo')}")
except Exception as e:
    print(f"calendario_axe ERROR: {e}")

print("\n--- Testing pedidos_reza query ---")
url_reza = f"{sb_url}/rest/v1/pedidos_reza?select=id,created_at,updated_at,nome,whatsapp,mensagem,status,observacao_interna,categoria,linha,vela,nome_terreiro,acesso_token&or=(tenant_id.eq.{tenant_id},lider_id.eq.{tenant_id})&status=in.(pendente,aceito,em_oracao,em_atendimento)&order=created_at.desc&limit=10"
try:
    req = urllib.request.Request(url_reza, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"pedidos_reza OK: {len(data)} rows")
        for row in data:
            print(f"  • Pedido: {row.get('id')} | Nome: {row.get('nome')} | Status: {row.get('status')}")
except Exception as e:
    print(f"pedidos_reza ERROR: {e}")

