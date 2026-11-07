import os
import json
from supabase import create_client

env_vars = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env_vars[k.strip()] = v.strip().strip('"\'')

url = env_vars.get('VITE_SUPABASE_URL') or env_vars.get('SUPABASE_URL')
key = env_vars.get('SUPABASE_SERVICE_ROLE_KEY') or env_vars.get('VITE_SUPABASE_ANON_KEY')
sb = create_client(url, key)

print("=== 1. WHATSAPP_LOGS RECENTES (ÚLTIMAS 50) ===")
res = sb.table('whatsapp_logs').select('*').order('created_at', desc=True).limit(50).execute()
for r in res.data:
    tel = r.get('telefone') or r.get('recipient_phone') or r.get('phone') or ''
    msg = r.get('mensagem') or r.get('template_name') or r.get('body') or ''
    created = r.get('created_at')
    tipo = r.get('tipo') or r.get('status')
    payload = r.get('payload') or r.get('raw_payload') or {}
    print(f"[{created}] TEL: {tel} | TIPO: {tipo} | MSG: {str(msg)[:100]}")
    if 'foto' in str(msg).lower() or 'none' in str(msg).lower() or 'foto' in str(payload).lower() or '11920033501' in str(tel):
        print(f"   -> DETALHE: {json.dumps(r, default=str, ensure_ascii=False)[:300]}")
