import json
import urllib.request
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
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

url = env.get('VITE_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

req = urllib.request.Request(f'{url}/rest/v1/subscriptions?select=*&order=expires_at.asc', headers=headers)
with urllib.request.urlopen(req) as res:
    subs = json.loads(res.read().decode())

req_perfis = urllib.request.Request(f'{url}/rest/v1/perfil_lider?select=*', headers=headers)
with urllib.request.urlopen(req_perfis) as res:
    perfis = {p['id']: p for p in json.loads(res.read().decode())}

print("=== ASSINATURAS ORDENADAS POR VENCIMENTO ===")
for s in subs:
    sid = s['id']
    p = perfis.get(sid, {})
    nome_t = p.get('nome_terreiro') or 'Sem Nome'
    zelador = p.get('cargo') or p.get('zelador') or 'Zelador'
    phone = p.get('whatsapp') or p.get('whatsapp_publico')
    status = s.get('status')
    exp = s.get('expires_at') or 'Sem Data'
    is_blocked = p.get('is_blocked')
    
    print(f"Vence: [{str(exp)[:10]}] | Status: {status} | Blocked: {is_blocked} | Terreiro: {nome_t} | Zelador: {zelador} | Fone: {phone} | ID: {sid}")
