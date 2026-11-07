import urllib.request
import json

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

sb_url = env["VITE_SUPABASE_URL"]
sb_key = env["SUPABASE_SERVICE_ROLE_KEY"]
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

phones = ["554896133539", "554888367666", "554884737314"]

for p in phones:
    print(f"\n=================== PHONE {p} ===================")
    # 1. admin_whatsapp_conversations
    url = f"{sb_url}/rest/v1/admin_whatsapp_conversations?phone_e164=ilike.*{p[-8:]}*&select=*"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"admin_whatsapp_conversations: {len(data)}")
        for r in data:
            print(f"  ID: {r.get('id')} | Name: {r.get('contact_name')} | Phone: {r.get('phone_e164')} | LeadId: {r.get('lead_id')} | Status: {r.get('status')}")
            lead_id = r.get('lead_id')
    
    # 2. whatsapp_logs
    url = f"{sb_url}/rest/v1/whatsapp_logs?telefone=ilike.*{p[-8:]}*&select=*"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"whatsapp_logs: {len(data)}")
        for r in data:
            print(f"  Tipo: {r.get('tipo')} | Status: {r.get('status')} | Msg: {str(r.get('mensagem'))[:70]}")
    
    # 3. growth_outreach_queue
    url = f"{sb_url}/rest/v1/growth_outreach_queue?phone_e164=ilike.*{p[-8:]}*&select=*"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"growth_outreach_queue: {len(data)}")
            for r in data:
                print(f"  ID: {r.get('id')} | Status: {r.get('status')} | ProspectId: {r.get('prospect_id')}")
    except Exception as e:
        print(f"growth_outreach_queue err: {e}")

    # 4. diretorio_nacional_axe
    url = f"{sb_url}/rest/v1/diretorio_nacional_axe?telefone=ilike.*{p[-8:]}*&select=id,nome,telefone,cidade,estado,responsavel"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"diretorio_nacional_axe: {len(data)}")
            for r in data:
                print(f"  Nome: {r.get('nome')} | Resp: {r.get('responsavel')} | Cidade: {r.get('cidade')}")
    except Exception as e:
        print(f"diretorio err: {e}")

