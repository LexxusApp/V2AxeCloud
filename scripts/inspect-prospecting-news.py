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
print(f"=== AUDITORIA DE PROSPECÇÃO ({now.strftime('%d/%m/%Y %H:%M:%S')}) ===")

# 1. Contagem por status em prospecting_leads
req_leads = urllib.request.Request(
    f"{url}/rest/v1/prospecting_leads?select=id,name,phone,city,state,status,score,last_contact_at,email,created_at&order=last_contact_at.desc.nullslast&limit=100",
    headers=headers
)
with urllib.request.urlopen(req_leads) as res:
    all_leads = json.loads(res.read().decode())

status_counts = {}
for l in all_leads:
    st = l.get("status", "unknown")
    status_counts[st] = status_counts.get(st, 0) + 1

print("\n--- DISTRIBUIÇÃO DOS LEADS POR STATUS ---")
for st, cnt in sorted(status_counts.items(), key=lambda x: -x[1]):
    print(f"• {st}: {cnt}")

interested = [l for l in all_leads if l.get("status") in ("interested", "replied", "trial")]
print(f"\n--- LEADS INTERESSADOS / RESPONDERAM / TRIAL ({len(interested)}) ---")
for l in interested:
    print(f"- [{l.get('status')}] {l.get('name')} | Tel: {l.get('phone')} | Cidade: {l.get('city')}-{l.get('state')} | Email: {l.get('email')} | Último Contato: {str(l.get('last_contact_at'))[:19]}")

# 2. Conversas recentes no WhatsApp Admin
print("\n--- CONVERSAS RECENTES NO WHATSAPP ADMIN (ÚLTIMAS 10) ---")
req_convs = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_conversations?select=*&order=last_message_at.desc.nullslast&limit=10",
    headers=headers
)
with urllib.request.urlopen(req_convs) as res:
    convs = json.loads(res.read().decode())

for c in convs:
    print(f"Conv ID: {c.get('id')} | Contato: {c.get('contact_name')} ({c.get('phone_e164')}) | Não lidas: {c.get('unread_count')} | Última em: {str(c.get('last_message_at'))[:19]}")
    print(f"  Preview: {c.get('last_message_preview')}\n")

# 3. Mensagens trocadas hoje
print("\n--- MENSAGENS RECEBIDAS / ENVIADAS HOJE (12/10) ---")
today_ymd = now.strftime("%Y-%m-%d")
req_msgs = urllib.request.Request(
    f"{url}/rest/v1/admin_whatsapp_messages?created_at=gte.{today_ymd}T00:00:00-03:00&order=created_at.desc&limit=30",
    headers=headers
)
try:
    with urllib.request.urlopen(req_msgs) as res:
        msgs = json.loads(res.read().decode())
    print(f"Total de mensagens trocadas hoje: {len(msgs)}")
    for m in msgs:
        direc = "⬅️ [INBOUND]" if m.get("direction") == "inbound" else "➡️ [OUTBOUND]"
        print(f"[{str(m.get('created_at'))[:19]}] {direc} {m.get('body')}")
except Exception as e:
    print("Erro ao buscar mensagens:", e)

# 4. Eventos de prospecção hoje
print("\n--- EVENTOS RECENTES EM PROSPECTING_EVENTS ---")
req_ev = urllib.request.Request(
    f"{url}/rest/v1/prospecting_events?order=created_at.desc&limit=10",
    headers=headers
)
try:
    with urllib.request.urlopen(req_ev) as res:
        events = json.loads(res.read().decode())
    for ev in events:
        print(f"[{str(ev.get('created_at'))[:19]}] Tipo: {ev.get('event_type')} | {ev.get('from_status')} -> {ev.get('to_status')} | Desc: {ev.get('description')}")
except Exception as e:
    print("Erro ao buscar eventos:", e)
