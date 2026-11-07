import json, urllib.request

def load_env(p):
    d = {}
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        for l in f:
            l = l.strip()
            if l and not l.startswith('#') and '=' in l:
                k, v = l.split('=', 1)
                d[k.strip()] = v.strip().strip('"').strip("'")
    return d

env = load_env('C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env')
url = env.get('VITE_SUPABASE_URL') or env.get('SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('VITE_SUPABASE_ANON_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

print("=== 1. BAIXAS / PAGAMENTOS RECENTES ===")
# Baixas de hoje (2026-11-05) e ontem (2026-11-04)
req = urllib.request.Request(f'{url}/rest/v1/financeiro?select=id,descricao,categoria,valor,status,data,created_at,tenant_id&status=eq.Pago&order=created_at.desc&limit=15', headers=headers)
with urllib.request.urlopen(req) as res:
    pagos = json.loads(res.read().decode('utf-8'))

print(f"Total baixas recentes retornadas: {len(pagos)}")
for p in pagos[:8]:
    print(f"  [{p.get('status')}] {p.get('data')} | {p.get('categoria')} | R$ {p.get('valor')} | {p.get('descricao')}")

print("\n=== 2. ATIVIDADE RECENTE DE TERREIROS (ÚLTIMAS 24H) ===")
# Terreiros com atualização recente em perfil ou tabelas
req2 = urllib.request.Request(f'{url}/rest/v1/perfil_lider?select=id,nome_terreiro,email,updated_at&order=updated_at.desc&limit=10', headers=headers)
with urllib.request.urlopen(req2) as res2:
    profiles = json.loads(res2.read().decode('utf-8'))

for pr in profiles[:6]:
    print(f"  {pr.get('nome_terreiro')} ({pr.get('email')}) -> updated: {pr.get('updated_at')}")

print("\n=== 3. AUDIT LOGS / ATIVIDADE DO SISTEMA HOJE ===")
req3 = urllib.request.Request(f'{url}/rest/v1/audit_logs?select=event_type,description,created_at,user_email&order=created_at.desc&limit=10', headers=headers)
try:
    with urllib.request.urlopen(req3) as res3:
        logs = json.loads(res3.read().decode('utf-8'))
        print(f"Total audit logs hoje: {len(logs)}")
        for l in logs[:6]:
            print(f"  {l.get('created_at')[:19]} | {l.get('event_type')} | {l.get('user_email')} | {l.get('description')}")
except Exception as e:
    print("Audit logs query:", e)

print("\n=== 4. TOTAL GERAL DE REGISTROS FINANCEIROS ===")
req4 = urllib.request.Request(f'{url}/rest/v1/financeiro?select=status', headers=headers)
with urllib.request.urlopen(req4) as res4:
    all_fin = json.loads(res4.read().decode('utf-8'))
    status_counts = {}
    for r in all_fin:
        s = r.get('status', 'unknown')
        status_counts[s] = status_counts.get(s, 0) + 1
    print("Status financeiro:", status_counts)
