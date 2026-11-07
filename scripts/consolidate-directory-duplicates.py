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

cases = [
    {
        "nome": "Ilê Axé Nanã Buruque",
        "keep_id": "03748fcf-78e2-4ccb-bee0-818cf851d98f",
        "tenant_id": "b47b3014-93c6-4d2b-b8c8-b57ecdc03666",
        "remove_id": "e33dbb04-5e96-4826-a901-2ce5dff51ac8",
        "whatsapp": "47999498604",
    },
    {
        "nome": "Terreiro de Umbanda Xangô Agodô Axé Casa Velha",
        "keep_id": "8f53eee5-e005-49b6-ab2b-3371598a96cb",
        "tenant_id": "8b3caf8b-030f-48d1-ba74-722ee26a27e7",
        "remove_id": "0012995b-12bc-4ffc-add6-315c5c5617fa",
        "whatsapp": "61999073429",
    }
]

print("=== CONSOLIDAÇÃO CASOS RESTANTES ===")
for c in cases:
    print(f"\nProcessando {c['nome']}...")
    
    # 1. Primeiro remove a duplicata (ou desvincula dela) para não violar unique constraint
    if c['remove_id']:
        url_del = f"{sb_url}/rest/v1/terreiros_diretorio?id=eq.{c['remove_id']}"
        req_del = urllib.request.Request(url_del, headers=headers, method='DELETE')
        try:
            with urllib.request.urlopen(req_del) as resp_del:
                print(f"  🗑️ Perfil duplicado ({c['remove_id']}) excluído com sucesso!")
        except urllib.error.HTTPError as e:
            print(f"  ❌ Erro ao excluir duplicata: {e.code} - {e.read().decode()}")
        except Exception as e:
            print(f"  ❌ Erro ao excluir duplicata: {e}")

    # 2. Atualizar o registro original (keep_id)
    update_data = {
        "claimed_by_tenant_id": c["tenant_id"],
        "whatsapp_atendimento": c["whatsapp"],
        "publicacao_status": "publicado"
    }
    url_up = f"{sb_url}/rest/v1/terreiros_diretorio?id=eq.{c['keep_id']}"
    req_up = urllib.request.Request(url_up, data=json.dumps(update_data).encode(), headers=headers, method='PATCH')
    try:
        with urllib.request.urlopen(req_up) as resp_up:
            res = json.loads(resp_up.read().decode())
            print(f"  ✅ Perfil original ({c['keep_id']}) atualizado e vinculado ao tenant {c['tenant_id'][:8]}...")
    except urllib.error.HTTPError as e:
        print(f"  ❌ Erro ao atualizar original: {e.code} - {e.read().decode()}")
    except Exception as e:
        print(f"  ❌ Erro ao atualizar original: {e}")

print("\n=== CONSOLIDAÇÃO CONCLUÍDA ===")
