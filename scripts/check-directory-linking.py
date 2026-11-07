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

print("=== VERIFICANDO VÍNCULO DOS TERREIROS COM O MAPA / DIRETÓRIO ===\n")

# 1. Busca os últimos 5 perfil_lider cadastrados
url_l = f"{sb_url}/rest/v1/perfil_lider?select=*&order=created_at.desc&limit=5"
req_l = urllib.request.Request(url_l, headers=headers)
with urllib.request.urlopen(req_l) as resp_l:
    leaders = json.loads(resp_l.read().decode())

for l in leaders:
    nome = l.get('nome_terreiro')
    email = l.get('email')
    lid = l.get('id')
    created = l.get('created_at')[:19]
    print(f"🏛️ LÍDER: {nome} ({email}) | Criado em: {created} | ID: {lid}")

    # Verifica se há busca em terreiros_diretorio por nome semelhante
    clean_name = nome.split()[0] if nome else ''
    url_d = f"{sb_url}/rest/v1/terreiros_diretorio?nome=ilike.*{clean_name}*&select=id,nome,cidade,estado,reivindicado,lider_id&limit=5"
    req_d = urllib.request.Request(url_d, headers=headers)
    try:
        with urllib.request.urlopen(req_d) as resp_d:
            matches = json.loads(resp_d.read().decode())
        print(f"   Matches no Diretório para '{clean_name}' ({len(matches)}):")
        for m in matches:
            reiv = "✅ REIVINDICADO" if m.get('reivindicado') else "❌ NÃO REIVINDICADO"
            lider_vinculado = m.get('lider_id')
            vinculo = f"Vinculado a {lider_vinculado}" if lider_vinculado else "Sem líder vinculado"
            print(f"     • {m.get('nome')} ({m.get('cidade')}-{m.get('estado')}) | {reiv} | {vinculo} | ID: {m.get('id')}")
    except Exception as e:
        print(f"   Erro ao buscar matches: {e}")

    # Verifica tabela diretorio_claims
    url_c = f"{sb_url}/rest/v1/diretorio_claims?email=eq.{email}&select=*&limit=3"
    try:
        req_c = urllib.request.Request(url_c, headers=headers)
        with urllib.request.urlopen(req_c) as resp_c:
            claims = json.loads(resp_c.read().decode())
        if claims:
            print(f"   📋 Claims encontradas para {email}: {len(claims)}")
            for c in claims:
                print(f"     • Status claim: {c.get('status')} | Terreiro ID: {c.get('terreiro_id')}")
        else:
            print(f"   ℹ️ Nenhuma claim direta em diretorio_claims para {email} (Cadastro via /register direto)")
    except Exception as e:
        print(f"   Erro ao checar claims: {e}")
    print("-" * 65)
