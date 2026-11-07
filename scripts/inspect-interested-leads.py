import json
import urllib.request
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env():
    env = {}
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('\'"')
    return env

env = load_env()
url = env.get('VITE_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

req = urllib.request.Request(f'{url}/rest/v1/prospecting_leads?status=eq.interested&select=id,name,phone,city,state,status,last_contact_at,email,created_at', headers=headers)
with urllib.request.urlopen(req) as res:
    leads = json.loads(res.read().decode())

print(f'Total interested leads: {len(leads)}')
for lead in leads:
    phone = lead.get('phone', '').replace('+', '').replace('-', '').replace(' ', '')
    print('='*70)
    print(f"LEAD: {lead.get('name')} | Tel: {lead.get('phone')} | Cidade: {lead.get('city')}-{lead.get('state')}")
    print(f"Last Contact: {lead.get('last_contact_at')} | Email: {lead.get('email')}")
    
    # Buscar conversa no admin_whatsapp_conversations
    search_digits = phone[-8:] if len(phone) >= 8 else phone
    req_c = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_conversations?phone_e164=like.*{search_digits}*&select=id,contact_name,last_message_at,last_message_preview", headers=headers)
    try:
        with urllib.request.urlopen(req_c) as resc:
            convs = json.loads(resc.read().decode())
        if convs:
            conv_id = convs[0]['id']
            print(f"Conversa ID: {conv_id} | Contato: {convs[0].get('contact_name')}")
            req_m = urllib.request.Request(f"{url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{conv_id}&order=created_at.asc&select=direction,body,created_at,message_type", headers=headers)
            with urllib.request.urlopen(req_m) as resm:
                msgs = json.loads(resm.read().decode())
            for m in msgs:
                d = '⬅️ INBOUND ' if m.get('direction') == 'inbound' else '➡️ OUTBOUND'
                print(f"  [{m.get('created_at')[:19]}] {d}: {m.get('body')}")
        else:
            print('Nenhuma conversa encontrada no admin_whatsapp_conversations')
    except Exception as e:
        print(f'Erro ao buscar conversa: {e}')
