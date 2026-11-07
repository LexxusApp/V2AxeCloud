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
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

def get(path):
    req = urllib.request.Request(f"{sb_url}/rest/v1/{path}", headers=headers)
    return json.loads(urllib.request.urlopen(req).read().decode())

convs = get("admin_whatsapp_conversations?order=last_message_at.desc&limit=200")

pending_action = []
opt_outs = []
auto_responders = []
old_unanswered = []

for c in convs:
    c_id = c['id']
    msgs = get(f"admin_whatsapp_messages?conversation_id=eq.{c_id}&order=created_at.desc&limit=3")
    if not msgs:
        continue
    last_msg = msgs[0]
    if last_msg.get('direction') == 'inbound':
        body = (last_msg.get('body') or '').strip()
        body_lower = body.lower()
        item = {
            'id': c_id,
            'name': c.get('contact_name') or 'Desconhecido',
            'phone': c.get('phone_e164'),
            'date': last_msg.get('created_at'),
            'body': body
        }
        
        if any(w in body_lower for w in ['agora não', 'agora nao', 'sair', 'parar', 'cancelar']):
            opt_outs.append(item)
        elif any(w in body_lower for w in ['agradece seu contato', 'obrigado por entrar em contato', 'horário de atendimento', 'mensagem automática', 'atendimento automático', 'não estamos disponíveis', 'no momento estamos ausentes']):
            auto_responders.append(item)
        else:
            pending_action.append(item)

print(f"=== RESULTADO DA AUDITORIA DA CAIXA DE ENTRADA (WHATSAPP CRM) ===")
print(f"Total de conversas analisadas: {len(convs)}")
print(f"1. Conversas aguardando resposta humana/comercial: {len(pending_action)}")
print(f"2. Opt-outs registrados ('Agora Não' / 'Sair'): {len(opt_outs)}")
print(f"3. Respostas automáticas de secretária eletrônica: {len(auto_responders)}\n")

print("==================================================================")
print("1. MENSAGENS PENDENTES DE RESPOSTA (HUMANA OU COMERCIAL):")
print("==================================================================")
for p in pending_action:
    print(f"\n• Contato: {p['name']} ({p['phone']}) | Data: {p['date']}")
    print(f"  Mensagem: \"{p['body']}\"")

print("\n==================================================================")
print("2. RESPOSTAS AUTOMÁTICAS DETECTADAS (SECRETÁRIAS ELETRÔNICAS):")
print("==================================================================")
for a in auto_responders:
    print(f"\n• Contato: {a['name']} ({a['phone']}) | Data: {a['date']}")
    print(f"  Mensagem: \"{a['body'][:100]}...\"")

print("\n==================================================================")
print("3. OPT-OUTS (NÃO ENVIAR MAIS):")
print("==================================================================")
for o in opt_outs[:10]:
    print(f"• {o['name']} ({o['phone']}): {o['body']}")
