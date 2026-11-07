import urllib.request
import json
from datetime import datetime

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

print("=== AUDITORIA DE NOVIDADES (16:50 até 18:45) ===")

# 1. Pai Cristian (Urandi)
try:
    req_sub = urllib.request.Request(f"{sb_url}/rest/v1/subscriptions?id=eq.3b0bac5d-93fd-4612-a0ef-00f41104593b", headers=headers)
    with urllib.request.urlopen(req_sub) as resp:
        sub = json.loads(resp.read().decode())
        if sub:
            s = sub[0]
            print(f"1. Pai Cristian (Urandi):")
            print(f"   Status: {s.get('status')} | Expira em: {s.get('expires_at')} | TxID: {s.get('efi_pix_txid')} | Atualizado: {s.get('updated_at')}")
    
    req_lead = urllib.request.Request(f"{sb_url}/rest/v1/perfil_lider?id=eq.3b0bac5d-93fd-4612-a0ef-00f41104593b", headers=headers)
    with urllib.request.urlopen(req_lead) as resp:
        lead = json.loads(resp.read().decode())
        if lead:
            l = lead[0]
            print(f"   Bloqueio: {l.get('is_blocked')} (Motivo: {l.get('access_block_reason')})")
except Exception as e:
    print("Erro Pai Cristian:", e)

# 2. Novos cadastros em perfil_lider desde 15:15 BRT (18:15 UTC)
try:
    req_leads = urllib.request.Request(f"{sb_url}/rest/v1/perfil_lider?created_at=gte.2026-10-22T18:15:00Z&order=created_at.desc", headers=headers)
    with urllib.request.urlopen(req_leads) as resp:
        new_leads = json.loads(resp.read().decode())
        print(f"\n2. Novos cadastros após as 15:15: {len(new_leads)}")
        for nl in new_leads:
            print(f"   - [{nl.get('created_at')}] {nl.get('cargo')} | {nl.get('nome_terreiro')} | {nl.get('email')} | Tel: {nl.get('whatsapp') or nl.get('whatsapp_publico')}")
except Exception as e:
    print("Erro novos cadastros:", e)

# 3. Novas mensagens no WhatsApp CRM desde as 18:00 UTC (15:00 BRT)
try:
    req_msgs = urllib.request.Request(f"{sb_url}/rest/v1/admin_whatsapp_messages?created_at=gte.2026-10-22T18:00:00Z&order=created_at.desc", headers=headers)
    with urllib.request.urlopen(req_msgs) as resp:
        msgs = json.loads(resp.read().decode())
        print(f"\n3. Mensagens trocadas no WhatsApp após as 15:00 ({len(msgs)}):")
        for m in msgs:
            print(f"   - [{m.get('created_at')}] {m.get('direction')}: {str(m.get('body') or '')[:80]}")
except Exception as e:
    print("Erro msgs:", e)

# 4. Logins recentes após as 18:00 UTC (15:00 BRT)
try:
    req_u = urllib.request.Request(f"{sb_url}/auth/v1/admin/users?per_page=50", headers=headers)
    with urllib.request.urlopen(req_u) as resp:
        users = json.loads(resp.read().decode()).get("users", [])
        afternoon_logins = [u for u in users if (u.get("last_sign_in_at") or "") >= "2026-10-22T18:00:00Z"]
        print(f"\n4. Logins após as 15:00 ({len(afternoon_logins)}):")
        for u in afternoon_logins:
            print(f"   - {u.get('email')} às {u.get('last_sign_in_at')}")
except Exception as e:
    print("Erro logins:", e)

# 5. Total de terreiros ativos agora
try:
    req_count = urllib.request.Request(f"{sb_url}/rest/v1/perfil_lider?select=id,deleted_at", headers=headers)
    with urllib.request.urlopen(req_count) as resp:
        all_l = json.loads(resp.read().decode())
        active = [l for l in all_l if not l.get("deleted_at")]
        print(f"\n5. Total de terreiros na base: {len(all_l)} (Ativos: {len(active)})")
except Exception as e:
    print("Erro count:", e)
