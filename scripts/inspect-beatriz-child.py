import urllib.request
import json

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

url = f"{sb_url}/rest/v1/filhos_de_santo?nome=ilike.*Sonnara*&select=*"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    filho = json.loads(resp.read().decode())
print("Filho:", filho)

# Log da mensagem enviada
url_msg = f"{sb_url}/rest/v1/meta_whatsapp_logs?phone_e164=ilike.*84965477*&select=*&order=created_at.desc&limit=3"
req_msg = urllib.request.Request(url_msg, headers=headers)
with urllib.request.urlopen(req_msg) as resp_msg:
    msgs = json.loads(resp_msg.read().decode())
print("\nMensagens enviadas para ela:")
for m in msgs:
    print(m.get('created_at'), m.get('template_name'), m.get('body_preview') or m.get('rendered_body'))
