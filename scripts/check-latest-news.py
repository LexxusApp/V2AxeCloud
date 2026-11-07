import json
import urllib.request
import sys
import datetime
import zoneinfo

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
headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

sp_tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
now = datetime.datetime.now(sp_tz)
print(f"=== VERIFICAÇÃO DE NOVIDADES ({now.strftime('%d/%m/%Y %H:%M:%S')}) ===")

# 1. Novas mensagens de WhatsApp desde 13:00 BRT (16:00 UTC)
req_msgs = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_messages?created_at=gte.2026-10-12T16:00:00Z&order=created_at.desc&limit=30",
    headers=headers
)
try:
    with urllib.request.urlopen(req_msgs) as res:
        msgs = json.loads(res.read().decode())
    print(f"\n1. MENSAGENS DE WHATSAPP (ÚLTIMAS HORAS): {len(msgs)}")
    for m in msgs:
        d = "⬅️ INBOUND" if m.get("direction") == "inbound" else "➡️ OUTBOUND"
        print(f"[{str(m.get('created_at'))[:19]}] {d} (Conv: {m.get('conversation_id')}): {m.get('body')}")
except Exception as e:
    print("Erro msgs:", e)

# 2. Conversas atualizadas recentemente
req_convs = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_conversations?updated_at=gte.2026-10-12T16:00:00Z&order=updated_at.desc&limit=10",
    headers=headers
)
try:
    with urllib.request.urlopen(req_convs) as res:
        convs = json.loads(res.read().decode())
    print(f"\n2. CONVERSAS ATUALIZADAS: {len(convs)}")
    for c in convs:
        print(f"[{str(c.get('updated_at'))[:19]}] {c.get('contact_name')} ({c.get('phone_e164')}): {c.get('last_message_preview')}")
except Exception as e:
    print("Erro convs:", e)

# 3. Novos eventos de prospecção desde 16:00 UTC
req_ev = urllib.request.Request(
    f"{url}/rest/v1/prospecting_events?created_at=gte.2026-10-12T16:00:00Z&order=created_at.desc&limit=25",
    headers=headers
)
try:
    with urllib.request.urlopen(req_ev) as res:
        evs = json.loads(res.read().decode())
    print(f"\n3. EVENTOS DE PROSPECÇÃO RECENTES: {len(evs)}")
    for ev in evs:
        print(f"[{str(ev.get('created_at'))[:19]}] Tipo: {ev.get('event_type')} | {ev.get('from_status')} -> {ev.get('to_status')} | {ev.get('description')}")
except Exception as e:
    print("Erro events:", e)

# 4. Novos terreiros cadastrados hoje
req_t = urllib.request.Request(
    f"{url}/rest/v1/terreiros?created_at=gte.2026-10-12T00:00:00Z&order=created_at.desc",
    headers=headers
)
try:
    with urllib.request.urlopen(req_t) as res:
        terrs = json.loads(res.read().decode())
    print(f"\n4. TERREIROS CADASTRADOS HOJE (12/10): {len(terrs)}")
    for t in terrs:
        print(f"- {t.get('nome')} (ID: {t.get('id')}) | Criado em: {str(t.get('created_at'))[:19]}")
except Exception as e:
    print("Erro terreiros:", e)

# 5. Status de leads em prospecting_leads
req_leads = urllib.request.Request(
    f"{url}/rest/v1/prospecting_leads?updated_at=gte.2026-10-12T16:00:00Z&order=updated_at.desc&limit=15",
    headers=headers
)
try:
    with urllib.request.urlopen(req_leads) as res:
        leads_up = json.loads(res.read().decode())
    print(f"\n5. LEADS COM ATUALIZAÇÃO RECENTE: {len(leads_up)}")
    for l in leads_up:
        print(f"- {l.get('name')} | Status: {l.get('status')} | Tel: {l.get('phone')} | Atualizado: {str(l.get('updated_at'))[:19]}")
except Exception as e:
    print("Erro leads:", e)
