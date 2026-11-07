import urllib.request
import json
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

print("=== TERREIROS COM DUPLICIDADE OU FALTA DE VÍNCULO NO MAPA ===")
# Busca perfil_lider que foram criados e verifica se geraram duplicata no mapa
url_p = f"{sb_url}/rest/v1/perfil_lider?select=id,nome_terreiro,email&limit=20"
req_p = urllib.request.Request(url_p, headers=headers)
with urllib.request.urlopen(req_p) as resp_p:
    leaders = json.loads(resp_p.read().decode())

for l in leaders:
    nome = l.get('nome_terreiro')
    tid = l.get('id')
    import urllib.parse
    url_d = f"{sb_url}/rest/v1/terreiros_diretorio?nome=ilike.*{urllib.parse.quote(nome)}*&select=id,nome,cidade,estado,claimed_by_tenant_id,slug"
    req_d = urllib.request.Request(url_d, headers=headers)
    try:
        with urllib.request.urlopen(req_d) as resp_d:
            rows = json.loads(resp_d.read().decode())
        if len(rows) > 1:
            print(f"\n⚠️ DUPLICIDADE ENCONTRADA: {nome}")
            for r in rows:
                c = f"VINCULADO ao Líder ({r.get('claimed_by_tenant_id')[:8]}...)" if r.get('claimed_by_tenant_id') else "NÃO VINCULADO (Registro Solto)"
                print(f"   • {r.get('nome')} ({r.get('cidade')}-{r.get('estado')}) | {c} | Slug: {r.get('slug')} | ID: {r.get('id')}")
    except Exception as e:
        pass
