import sys
import json
import urllib.request
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

print("=" * 60)
print("  DETALHAMENTO DE CONVERSAS E EVENTOS DE 14/10/2026")
print("=" * 60)

# 1. Conversas atualizadas hoje
convs = query("admin_whatsapp_conversations?order=updated_at.desc&limit=12")
print(f"\n1. ÚLTIMAS CONVERSAS NO WHATSAPP ADMIN ({len(convs)}):")
for c in convs:
    print(f"  • {c.get('contact_name')} ({c.get('phone_e164')}):")
    print(f"    Status: {c.get('status')} | Não lidas: {c.get('unread_count')} | Atualizado: {c.get('updated_at')}")
    print(f"    Última mensagem: {c.get('last_message_preview')}")

# 2. Mensagens trocadas hoje (14/10)
today_iso = "2026-10-14T00:00:00Z"
try:
    msgs = query(f"admin_whatsapp_messages?created_at=gte.{today_iso}&order=created_at.desc&limit=5")
    print(f"\n2. MENSAGENS RECEBIDAS / ENVIADAS HOJE ({len(msgs)}):")
    if msgs:
        print("EXEMPLO DE MENSAGEM RAW:")
        print(json.dumps(msgs[0], indent=2, ensure_ascii=False))
except Exception as e:
    print(f"\n2. Erro mensagens: {e}")

# 3. Novos cadastros (perfil_lider) hoje
try:
    perfis = query(f"perfil_lider?created_at=gte.{today_iso}&order=created_at.desc")
    print(f"\n3. NOVOS CADASTROS HOJE (14/10) ({len(perfis)}):")
    for p in perfis:
        print(f"  • {p.get('nome_zelador')} - Terreiro: {p.get('nome_terreiro')} ({p.get('telefone') or p.get('email')}) - Criado: {p.get('created_at')}")
except Exception as e:
    print(f"\n3. Erro perfis: {e}")

# 4. Logins de hoje (auth_audit_log ou audit_logs)
try:
    logins = query(f"audit_logs?created_at=gte.{today_iso}&action=ilike.*login*&order=created_at.desc&limit=15")
    print(f"\n4. LOGINS REGISTRADOS HOJE ({len(logins)}):")
    for l in logins:
        print(f"  [{l.get('created_at')}] {l.get('action')} - Usuário: {l.get('user_email') or l.get('metadata')}")
except Exception as e:
    print(f"\n4. Erro ao checar audit_logs: {e}")

# 5. Detalhar conversas dos interessados
for tel in ['554796528045', '554898538834', '554898384895', '554988151188', '554896619894']:
    conv = query(f"admin_whatsapp_conversations?phone_e164=eq.{tel}")
    if conv:
        c = conv[0]
        cid = c['id']
        msgs = query(f"admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.asc")
        lead = query(f"prospecting_leads?phone=ilike.*{tel[-8:]}*")
        lead_st = lead[0].get('status') if lead else 'Sem lead'
        lead_name = lead[0].get('name') or lead[0].get('terreiro_name') if lead else 'Sem nome'
        print(f"\n--- CONVERSA: {c.get('contact_name')} ({tel}) | Status Conv: {c.get('status')} | Lead: {lead_st} ({lead_name}) ---")
        for m in msgs:
            print(f"  [{m.get('created_at')}] {m.get('direction')}: {m.get('body')}")




# 6. Contagens gerais
try:
    req_pl = urllib.request.Request(f"{url}/rest/v1/perfil_lider?select=id", headers={**headers, "Range": "0-0", "Prefer": "count=exact"})
    with urllib.request.urlopen(req_pl) as resp:
        print(f"\n6. TOTAL DE TERREIROS CADASTRADOS: {resp.headers.get('Content-Range')}")
    
    req_f = urllib.request.Request(f"{url}/rest/v1/filhos_santo?select=id", headers={**headers, "Range": "0-0", "Prefer": "count=exact"})
    with urllib.request.urlopen(req_f) as resp:
        print(f"   TOTAL DE FILHOS DE SANTO: {resp.headers.get('Content-Range')}")

    leads_all = query("prospecting_leads?select=status")
    st = {}
    for l in leads_all:
        s = l.get('status') or 'unknown'
        st[s] = st.get(s, 0) + 1
    print(f"   STATUS DO CRM DE PROSPECÇÃO: {st}")
except Exception as e:
    print(f"\n6. Erro ao buscar totais: {e}")

