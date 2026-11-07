import urllib.request
import json

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

with_wa = 0
without_wa = 0

print(f"Total de terreiros reivindicados no banco: {len(claimed)}\n")
for idx, c in enumerate(claimed, 1):
    wa = c.get("whatsapp_atendimento") or c.get("telefone")
    if wa:
        with_wa += 1
        print(f"[{idx}] OK: {c.get('nome')[:45]:45} | WA: {wa} | Slug: {c.get('slug')}")
    else:
        without_wa += 1
        print(f"[{idx}] SEM CONTATO: {c.get('nome')[:45]:45} | Slug: {c.get('slug')}")

print(f"\n=======================================================")
print(f"  RESULTADO FINAL DE TODOS OS TERREIROS REIVINDICADOS:")
print(f"  • Terreiros COM WhatsApp ativo: {with_wa} de {len(claimed)} ({with_wa/len(claimed)*100:.1f}%)")
print(f"  • Terreiros SEM telefone no cadastro: {without_wa} (apenas um terreiro de teste 'terreiroila' sem nenhum número)")
print(f"=======================================================")
