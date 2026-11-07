import urllib.request
import json
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open('AxecloudV2/.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

# 1. Fetch all interested leads
req_int = urllib.request.Request(f"{sb_url}/rest/v1/prospecting_leads?status=eq.interested&order=updated_at.desc", headers=headers)
with urllib.request.urlopen(req_int) as resp:
    interested_leads = json.loads(resp.read().decode())

# 2. Fetch all admin conversations
req_conv = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_conversations?select=id,phone_e164,contact_name,last_message_at,last_message_preview,unread_count,status", headers=headers)
with urllib.request.urlopen(req_conv) as resp:
    all_convs = json.loads(resp.read().decode())

conv_map = {}
for c in all_convs:
    p = c.get('phone_e164') or ''
    digits = ''.join(ch for ch in p if ch.isdigit())
    if digits:
        conv_map[digits] = c
        if len(digits) >= 8:
            conv_map[digits[-8:]] = c
            conv_map[digits[-9:]] = c

print(f"Total de leads 'interested': {len(interested_leads)}")
print(f"Total de conversas WhatsApp no admin: {len(all_convs)}\n")

leads_waiting = []
leads_replied = []
leads_without_chat = []

for lead in interested_leads:
    phone = lead.get('phone_normalized') or lead.get('phone') or ''
    digits = ''.join(ch for ch in phone if ch.isdigit())
    
    # Try finding conv
    conv = conv_map.get(digits) or (conv_map.get(digits[-8:]) if len(digits) >= 8 else None) or (conv_map.get(digits[-9:]) if len(digits) >= 9 else None)
    
    if not conv:
        leads_without_chat.append(lead)
        continue
    
    conv_id = conv.get('id')
    # Fetch last 3 messages for this conversation
    req_msgs = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{conv_id}&order=created_at.desc&limit=5", headers=headers)
    with urllib.request.urlopen(req_msgs) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    
    if not msgs:
        leads_without_chat.append(lead)
        continue
        
    last_msg = msgs[0]
    if last_msg.get('direction') == 'inbound':
        leads_waiting.append((lead, conv, last_msg, msgs))
    else:
        leads_replied.append((lead, conv, last_msg, msgs))

print("="*75)
print(f"🚨 LEADS AGUARDANDO RESPOSTA (Última mensagem é INBOUND do líder): {len(leads_waiting)}")
print("="*75)
for idx, (lead, conv, last_msg, msgs) in enumerate(leads_waiting, 1):
    print(f"\n{idx}. {lead.get('name')} ({lead.get('city')}-{lead.get('state')})")
    print(f"   Telefone: {conv.get('phone_e164')} | Contato: {conv.get('contact_name')}")
    print(f"   Horário da mensagem: {str(last_msg.get('created_at'))[:19]}")
    print(f"   📩 Mensagem: \"{last_msg.get('body')}\"")
    print(f"   Não lidas: {conv.get('unread_count')}")

print("\n" + "="*75)
print(f"✅ LEADS RESPONDIDOS (Última mensagem foi nossa - OUTBOUND): {len(leads_replied)}")
print("="*75)
for idx, (lead, conv, last_msg, msgs) in enumerate(leads_replied, 1):
    print(f"{idx}. {lead.get('name')} ({lead.get('city')}-{lead.get('state')})")
    print(f"   Telefone: {conv.get('phone_e164')} | Data: {str(last_msg.get('created_at'))[:19]}")
    print(f"   📤 Nossa resposta: \"{(last_msg.get('body') or '')[:80]}...\"\n")

print("\n" + "="*75)
print(f"ℹ️ LEADS MARCADOS COMO INTERESTED MAS SEM CONVERSA DIRETA NO WHATSAPP: {len(leads_without_chat)}")
print("="*75)
for idx, lead in enumerate(leads_without_chat, 1):
    print(f"{idx}. {lead.get('name')} ({lead.get('city')}-{lead.get('state')}) | Tel: {lead.get('phone')}")
    print(f"   AI Summary: {lead.get('ai_summary') or 'Sem resumo'}")
    print(f"   Atualizado: {str(lead.get('updated_at'))[:19]}")
