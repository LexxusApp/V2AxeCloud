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

new_tenants = [
    ("yle ase Tobi omim Yna", "7c8b83b6-5561-4595-85df-ef290d2e6baa", "Joinville", "SC"),
    ("ORDEM FLORESTA MÍSTICA", "36a9bc9c-edf3-4257-af35-aeb03ae4ed90", None, None),
    ("Centro Espírita de Umbanda Caboclo Pena Verde", "b1121595-7b51-4af3-8352-8f249b0dbc11", None, None),
    ("Ilé Àṣẹ Ona Omi Ọ̀ṣun", "076da0f5-a73f-45a1-a942-49f11309e584", None, None),
    ("TUSS", "d9c33004-b7fc-4d08-8cf0-f251c605e142", None, None)
]

print("=== VERIFICAÇÃO DETALHADA: TERREIROS NOVOS NO DIRETÓRIO / MAPA ===")

for nome, tid, cidade, uf in new_tenants:
    print(f"\n🏛️ TERREIRO: {nome} (Tenant: {tid})")

    # 1. Verifica se existe registro em terreiros_diretorio vinculado a este tenant (claimed_by_tenant_id)
    url_v = f"{sb_url}/rest/v1/terreiros_diretorio?claimed_by_tenant_id=eq.{tid}&select=id,nome,cidade,estado,slug,publicacao_status,claimed_by_tenant_id,latitude,longitude"
    req_v = urllib.request.Request(url_v, headers=headers)
    with urllib.request.urlopen(req_v) as resp_v:
        linked = json.loads(resp_v.read().decode())
    
    if linked:
        print(f"  ✅ Perfil VINCULADO no Diretório encontrado ({len(linked)}):")
        for row in linked:
            print(f"     ID: {row['id']} | Nome: {row['nome']} | Cidade: {row['cidade']}-{row['estado']} | Status: {row['publicacao_status']} | Slug: {row['slug']}")
    else:
        print("  ⚠️ NENHUM perfil com claimed_by_tenant_id vinculado a este tenant!")

    # 2. Busca se havia um registro antigo não reivindicado com nome parecido (da raspagem do Google Maps)
    # Pega palavras chaves do nome
    words = [w for w in nome.replace("'", " ").replace("’", " ").replace("-", " ").split() if len(w) >= 4 and w.lower() not in ["centro", "espirita", "tenda", "terreiro", "ile", "ase", "ordem"]]
    kw = words[0] if words else nome.split()[0]
    import urllib.parse
    url_s = f"{sb_url}/rest/v1/terreiros_diretorio?nome=ilike.*{urllib.parse.quote(kw)}*&select=id,nome,cidade,estado,claimed_by_tenant_id&limit=5"
    req_s = urllib.request.Request(url_s, headers=headers)
    try:
        with urllib.request.urlopen(req_s) as resp_s:
            scraped = json.loads(resp_s.read().decode())
        print(f"  🔍 Registros encontrados na busca por '{kw}' ({len(scraped)}):")
        for s in scraped:
            c_tid = s.get('claimed_by_tenant_id')
            c_str = f"Vinculado a {c_tid[:8]}..." if c_tid else "NÃO REIVINDICADO (Solto no mapa)"
            print(f"     • {s['nome']} ({s['cidade']}-{s['estado']}) | {c_str} | ID: {s['id']}")
    except Exception as e:
        print(f"  Erro ao buscar registros antigos: {e}")
