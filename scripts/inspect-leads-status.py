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

phones = [
    ("Wilian Maya", "554799298016"),
    ("Mãe Cleize De Bara", "554896710912"),
    ("Centro De Magia", "554896456341"),
    ("Sandra", "554888745143"),
    ("Cristina De Oya", "554788009330"),
    ("Yle ase", "554797394827"),
    ("Casa Grande", "554791476015"),
    ("Mãe Tânia d Oxum", "554791969424"),
    ("Eduardo tec lights", "554884737314"),
    ("Ricardo Marcelo Laurindo", "554896133539"),
    ("BAMBAM", "554888367666"),
    ("Mauricio Wandelburk", "554792074260"),
    ("Sabrina Thinassi", "556186533014"),
    ("Rosana", "554796528045"),
    ("Mãe Lorhana de Oxum", "554988151188")
]

print("=== STATUS DAS RESPOSTAS DESSES LEADS ===")
for name, phone in phones:
    url_c = f"{sb_url}/rest/v1/admin_whatsapp_conversations?phone_e164=eq.{phone}&select=*"
    req_c = urllib.request.Request(url_c, headers=headers)
    with urllib.request.urlopen(req_c) as resp_c:
        convs = json.loads(resp_c.read().decode())
    if not convs:
        print(f"\n❌ {name} ({phone}): Sem conversa registrada")
        continue
    cid = convs[0]['id']
    url_m = f"{sb_url}/rest/v1/admin_whatsapp_messages?conversation_id=eq.{cid}&order=created_at.desc&limit=2"
    req_m = urllib.request.Request(url_m, headers=headers)
    with urllib.request.urlopen(req_m) as resp_m:
        msgs = json.loads(resp_m.read().decode())
    
    last = msgs[0] if msgs else {}
    last_dir = last.get('direction')
    last_body = (last.get('body') or '')[:90].replace('\n', ' ')
    last_time = str(last.get('created_at'))[:19]
    print(f"\n• {name} ({phone}):")
    print(f"  Última msg: [{last_dir.upper()}] em {last_time} -> \"{last_body}...\"")
