import urllib.request
import json

def digitsOnly(val):
    return ''.join(c for c in str(val or '') if c.isdigit())

def normalizeBrazilianPhone_CURRENT(val):
    digits = digitsOnly(val)
    if digits.startswith('00'): digits = digits[2:]
    if len(digits) == 10 or len(digits) == 11: digits = '55' + digits
    if len(digits) != 12 and len(digits) != 13: return None
    if not digits.startswith('55'): return None
    return digits

def normalizeBrazilianPhone_FIXED(val):
    digits = digitsOnly(val)
    if digits.startswith('00'): digits = digits[2:]
    # Se começar com um único zero de DDD (ex: 011915128744), remove o 0!
    if len(digits) in (11, 12) and digits.startswith('0'):
        digits = digits[1:]
    if len(digits) == 10 or len(digits) == 11:
        digits = '55' + digits
    # Se faltar o 9 em celular com 55 (ex: 55 + 2 DDD + 8 dígitos = 12 dígitos)
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
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

req = urllib.request.Request(f"{sb_url}/rest/v1/terreiros_diretorio?claimed_by_tenant_id=not.is.null&select=slug,nome,telefone,whatsapp_atendimento,claimed_by_tenant_id", headers=headers)
with urllib.request.urlopen(req) as resp:
    claimed = json.loads(resp.read().decode())
    
print(f"Total de terreiros reivindicados: {len(claimed)}")
broken_now = 0
for c in claimed:
    slug = c.get("slug")
    tel = c.get("telefone")
    wa = c.get("whatsapp_atendimento")
    curr = normalizeBrazilianPhone_CURRENT(wa or tel)
    fixed = normalizeBrazilianPhone_FIXED(wa or tel)
    if not curr:
        broken_now += 1
        print(f"Sem botão hoje: {slug} | tel={tel} | wa={wa} -> Corrigido: {fixed}")

print(f"\nResumo: {broken_now} de {len(claimed)} terreiros estão SEM botão de WhatsApp hoje!")
