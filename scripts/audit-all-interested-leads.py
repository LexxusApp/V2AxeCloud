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

print("=================================================================")
print("🎯 AUDITORIA COMPLETA DE LEADS INTERESSADOS / PENDENTES DE CADASTRO")
print("=================================================================\n")

# 1. Leads com status 'interested' ou 'replied'
url = f"{sb_url}/rest/v1/prospecting_leads?status=in.(interested,replied,trial)&order=updated_at.desc"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    leads = json.loads(resp.read().decode())

print(f"Total de Leads em 'interested', 'replied' ou 'trial': {len(leads)}\n")

for idx, l in enumerate(leads, 1):
    print(f"{idx}. [{l.get('status').upper()}] {l.get('name')}")
    print(f"   📱 Telefone: {l.get('phone')} | Cidade: {l.get('city')}-{l.get('state')}")
    print(f"   📧 E-mail: {l.get('email') or 'Não informado ainda'}")
    print(f"   🕒 Último contato: {str(l.get('last_contact_at'))[:19]}")
    print(f"   🆔 Lead ID: {l.get('id')}\n")

# 2. Conversas no WhatsApp com intenção ou mensagens
print("\n--- CONVERSAS RECENTES NO WHATSAPP ADMIN COM MENSAGEM HUMANA ---")
url_c = f"{sb_url}/rest/v1/admin_whatsapp_conversations?order=last_message_at.desc&limit=25"
req_c = urllib.request.Request(url_c, headers=headers)
with urllib.request.urlopen(req_c) as resp_c:
    convs = json.loads(resp_c.read().decode())

for c in convs:
    preview = c.get('last_message_preview') or ''
    # filtra mensagens que parecem opt-out puro
    if preview == 'Sair':
        continue
    name = c.get('contact_name') or 'Sem nome'
    phone = c.get('phone_e164')
    last_at = str(c.get('last_message_at'))[:19]
    print(f"• {name} ({phone}) | Última: {last_at}")
    print(f"  Última mensagem: {preview[:100]}...\n")
