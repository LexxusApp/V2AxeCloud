import urllib.request
import urllib.error
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
headers = {
    'apikey': sb_key,
    'Authorization': f'Bearer {sb_key}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

nana_keep_id = "03748fcf-78e2-4ccb-bee0-818cf851d98f"
nana_tenant_id = "b47b3014-5ff5-4ffb-aba5-78a4f2aa253a"

print("Atualizando Nanã Buruque...")
update_data = {
    "claimed_by_tenant_id": nana_tenant_id,
    "whatsapp_atendimento": "47999498604",
    "publicacao_status": "publicado"
}
url_up = f"{sb_url}/rest/v1/terreiros_diretorio?id=eq.{nana_keep_id}"
req_up = urllib.request.Request(url_up, data=json.dumps(update_data).encode(), headers=headers, method='PATCH')
try:
    with urllib.request.urlopen(req_up) as resp_up:
        res = json.loads(resp_up.read().decode())
        print(f"  ✅ Perfil original Nanã Buruque ({nana_keep_id}) atualizado e vinculado ao tenant {nana_tenant_id[:8]} com sucesso!")
except urllib.error.HTTPError as e:
    print(f"  ❌ Erro ao atualizar Nanã: {e.code} - {e.read().decode()}")
except Exception as e:
    print(f"  ❌ Erro ao atualizar Nanã: {e}")
