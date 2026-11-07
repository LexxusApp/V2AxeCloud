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

url = f"{sb_url}/rest/v1/perfil_lider?select=id,nome_terreiro,email,cargo,whatsapp_publico"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    leaders = json.loads(resp.read().decode())

print(f"=== TOTAL DE LÍDERES/TENANTS CADASTRADOS: {len(leaders)} ===")
for l in leaders:
    tid = l['id']
    nome = l.get('nome_terreiro', '')
    email = l.get('email', '')
    tel = l.get('whatsapp_publico', '')
    
    # 1. Perfis com claimed_by_tenant_id = tid
    url_t = f"{sb_url}/rest/v1/terreiros_diretorio?claimed_by_tenant_id=eq.{tid}&select=id,nome,cidade,estado,slug,publicacao_status,claimed_by_tenant_id"
    req_t = urllib.request.Request(url_t, headers=headers)
    with urllib.request.urlopen(req_t) as resp_t:
        linked_rows = json.loads(resp_t.read().decode())
        
    print(f"\n👑 Líder: {nome} | Email: {email} | Tel: {tel}")
    print(f"   Vínculos diretos com tenant_id ({len(linked_rows)}):")
    for r in linked_rows:
        print(f"   ✅ ID: {r['id']} | Nome: {r['nome']} ({r['cidade']}-{r['estado']}) | Slug: {r['slug']} | Status: {r['publicacao_status']}")
        
    # 2. Verificar se existe registro solto não reivindicado com nome parecido
    if nome:
        import urllib.parse
        # pegar primeira palavra ou nome limpo
        clean_name = nome.strip()
        url_d = f"{sb_url}/rest/v1/terreiros_diretorio?nome=ilike.*{urllib.parse.quote(clean_name)}*&select=id,nome,cidade,estado,slug,claimed_by_tenant_id"
        req_d = urllib.request.Request(url_d, headers=headers)
        try:
            with urllib.request.urlopen(req_d) as resp_d:
                similar = json.loads(resp_d.read().decode())
            unclaimed = [s for s in similar if not s.get('claimed_by_tenant_id')]
            if unclaimed:
                print(f"   ⚠️ ATENÇÃO: Encontrados {len(unclaimed)} perfil(is) SOLTO(S) com nome similar no mapa:")
                for u in unclaimed:
                    print(f"      • ID: {u['id']} | Nome: {u['nome']} ({u['cidade']}-{u['estado']}) | Slug: {u['slug']}")
        except Exception as e:
            print(f"   Erro ao buscar similares: {e}")
