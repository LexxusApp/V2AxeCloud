import urllib.request
import json

def digitsOnly(val):
    return ''.join(c for c in str(val or '') if c.isdigit())

def normalizeBrazilianPhone_FIXED(val):
    digits = digitsOnly(val)
    if digits.startswith('00'): digits = digits[2:]
    if len(digits) in (11, 12) and digits.startswith('0'):
        digits = digits[1:]
    if len(digits) == 10 or len(digits) == 11:
        digits = '55' + digits
    if len(digits) == 12 and digits.startswith('55'):
        digits = digits[:4] + '9' + digits[4:]
    if len(digits) != 13 or not digits.startswith('55'):
        return None
    return digits

def load_env(path=".env"):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env()
sb_url = env.get('VITE_SUPABASE_URL')
sb_key = env.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}', 'Content-Type': 'application/json'}

print("=== INICIANDO SINCRONIZAÇÃO E CORREÇÃO DOS TELEFONES / WHATSAPP NO BANCO ===")

req = urllib.request.Request(f'{sb_url}/rest/v1/terreiros_diretorio?claimed_by_tenant_id=not.is.null&select=id,slug,nome,telefone,whatsapp_atendimento,claimed_by_tenant_id', headers=headers)
with urllib.request.urlopen(req) as resp:
    claimed = json.loads(resp.read().decode())

updated_count = 0
for c in claimed:
    tid = c.get('claimed_by_tenant_id')
    curr_wa = c.get('whatsapp_atendimento')
    tel = c.get('telefone')
    slug = c.get('slug')
    id_row = c.get('id')
    
    # Busca perfil do líder
    leader_wa = None
    if tid:
        try:
            req_l = urllib.request.Request(f'{sb_url}/rest/v1/perfil_lider?id=eq.{tid}&select=whatsapp,whatsapp_publico', headers=headers)
            with urllib.request.urlopen(req_l) as resp_l:
                l_data = json.loads(resp_l.read().decode())
                if l_data:
                    leader_wa = l_data[0].get('whatsapp_publico') or l_data[0].get('whatsapp')
        except Exception as e:
            pass
            
    # Resolve melhor número
    norm = normalizeBrazilianPhone_FIXED(curr_wa) or normalizeBrazilianPhone_FIXED(tel) or normalizeBrazilianPhone_FIXED(leader_wa)
    
    if not norm:
        print(f"[SEM CONTATO] {slug}")
        continue
        
    # Prepara campos limpos
    clean_tel = tel
    if clean_tel and clean_tel.startswith('0') and len(clean_tel) in (11, 12):
        clean_tel = clean_tel[1:]
    if not clean_tel:
        clean_tel = norm[2:]
        
    clean_wa = norm[2:] # Salva no formato nacional DDD+9 (11 dígitos)
    
    patch_body = {}
    if c.get('whatsapp_atendimento') != clean_wa:
        patch_body['whatsapp_atendimento'] = clean_wa
    if c.get('telefone') != clean_tel:
        patch_body['telefone'] = clean_tel
        
    if patch_body:
        req_patch = urllib.request.Request(
            f"{sb_url}/rest/v1/terreiros_diretorio?id=eq.{id_row}",
            data=json.dumps(patch_body).encode("utf-8"),
            headers=headers,
            method="PATCH"
        )
        try:
            with urllib.request.urlopen(req_patch) as resp_patch:
                print(f"[ATUALIZADO] {slug} -> {patch_body}")
                updated_count += 1
        except Exception as e:
            print(f"[ERRO PATCH] {slug}: {e}")

print(f"\nSincronização concluída! {updated_count} terreiros atualizados no banco de dados.")
