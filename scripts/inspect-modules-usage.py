import json
import urllib.request
import sys
from datetime import datetime, timezone, timedelta

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env(path=".env"):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env()
url = env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

def query(endpoint):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

today_iso = "2026-10-14T00:00:00Z"
yesterday_iso = "2026-10-13T00:00:00Z"

print("=" * 65)
print("  ATIVIDADE DETALHADA DE USO DOS MÓDULOS (HOJE E ÚLTIMAS 24H)")
print("=" * 65)

# 1. FILHOS DE SANTO
try:
    filhos = query(f"filhos_de_santo?created_at=gte.{yesterday_iso}&order=created_at.desc&limit=10")
    print(f"\n[1] FILHOS DE SANTO CRIADOS DESDE ONTEM ({len(filhos)}):")
    for f in filhos:
        print(f"  • [{f.get('created_at')}] {f.get('nome')} ({f.get('cargo') or 'Membro'}) - Orixá: {f.get('orixa_frente')} - Terreiro: {f.get('tenant_id')}")
except Exception as e:
    print(f"\n[1] Filhos de santo erro: {e}")

# 2. CALENDÁRIO / GIRAS
try:
    cal = query(f"calendario_axe?created_at=gte.{yesterday_iso}&order=created_at.desc&limit=10")
    print(f"\n[2] GIRAS / EVENTOS CRIADOS DESDE ONTEM ({len(cal)}):")
    for c in cal:
        print(f"  • [{c.get('created_at')}] {c.get('titulo')} - Data: {c.get('data')} às {c.get('hora')} - Terreiro: {c.get('tenant_id')}")
except Exception as e:
    print(f"\n[2] Calendario erro: {e}")

# 3. FINANCEIRO
try:
    fin = query(f"financeiro?created_at=gte.{yesterday_iso}&order=created_at.desc&limit=10")
    print(f"\n[3] REGISTROS FINANCEIROS CRIADOS DESDE ONTEM ({len(fin)}):")
    for fn in fin:
        print(f"  • [{fn.get('created_at')}] R$ {fn.get('valor')} - Tipo: {fn.get('tipo')} ({fn.get('categoria')}) - Desc: {fn.get('descricao')} - Status: {fn.get('status')}")
except Exception as e:
    print(f"\n[3] Financeiro erro: {e}")



# 4. VISITAS PÚBLICAS AO SITE HOJE
try:
    req_cnt = urllib.request.Request(f"{url}/rest/v1/public_site_page_views?created_at=gte.{today_iso}&select=id", headers={**headers, "Range": "0-0", "Prefer": "count=exact"})
    with urllib.request.urlopen(req_cnt) as resp_cnt:
        print(f"\n[4] TOTAL DE VISUALIZAÇÕES DE PÁGINAS HOJE (14/10): {resp_cnt.headers.get('Content-Range')}")

    views = query(f"public_site_page_views?created_at=gte.{today_iso}&order=created_at.desc&limit=15")
    print(f"  Últimas visualizações registradas:")
    for v in views[:8]:
        print(f"  • [{v.get('created_at')}] Rota: {v.get('path')} | Ref: {v.get('referrer')}")
except Exception as e:
    print(f"\n[4] Views erro: {e}")

# 5. VISUALIZAÇÕES DE PERFIS NO DIRETÓRIO HOJE
try:
    pviews = query(f"portal_profile_views?created_at=gte.{today_iso}&order=created_at.desc&limit=10")
    print(f"\n[5] VISUALIZAÇÕES NO DIRETÓRIO HOJE ({len(pviews)}):")
    for pv in pviews:
        print(f"  • [{pv.get('created_at')}] Terreiro ID: {pv.get('terreiro_id')} | Slug: {pv.get('slug')}")
except Exception as e:
    print(f"\n[5] Portal views erro: {e}")
