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

req = urllib.request.Request(f"{sb_url}/rest/v1/terreiros_diretorio?claimed_by_tenant_id=not.is.null&select=id,nome,slug,telefone,whatsapp_atendimento,claimed_by_tenant_id", headers=headers)
with urllib.request.urlopen(req) as resp:
    claimed = json.loads(resp.read().decode())
    print(f"Total de terreiros com claimed_by_tenant_id: {len(claimed)}")
    for c in claimed:
        tid = c.get("claimed_by_tenant_id")
        req_l = urllib.request.Request(f"{sb_url}/rest/v1/perfil_lider?id=eq.{tid}&select=cargo,email,whatsapp,whatsapp_publico", headers=headers)
        try:
            with urllib.request.urlopen(req_l) as resp_l:
                l_data = json.loads(resp_l.read().decode())
                leader = l_data[0] if l_data else {}
        except:
            leader = {}
        print(f"[{c.get('slug')}] - {c.get('nome')}")
        print(f"   Diretório: Telefone={c.get('telefone')} | whatsapp_atendimento={c.get('whatsapp_atendimento')}")
        print(f"   Líder: WA={leader.get('whatsapp')} | WA_Publico={leader.get('whatsapp_publico')}")
