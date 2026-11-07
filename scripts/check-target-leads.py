import urllib.request
import json

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env['VITE_SUPABASE_URL'].strip()
sb_key = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
headers = {'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}

phones = ['554896710912', '554896456341']
print("=== VERIFICANDO LEADS DAS CONVERSAS QUE DERAM 'QUERO CONHECER' ===")
for p in phones:
    # Busca em prospecting_leads
    url = f"{sb_url}/rest/v1/prospecting_leads?phone=ilike.*{p[-8:]}*&select=*"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        leads = json.loads(resp.read().decode())
    print(f"\nTelefone: {p} -> Leads encontrados: {len(leads)}")
    for l in leads:
        print(f"  ID: {l.get('id')} | Nome: {l.get('name')} | Status: {l.get('status')} | Phone: {l.get('phone')} | Terreiro: {l.get('terreiro_id')}")

    # Busca em prospecting_events
    if leads:
        lid = leads[0]['id']
        url_e = f"{sb_url}/rest/v1/prospecting_events?lead_id=eq.{lid}&order=created_at.desc&limit=5"
        req_e = urllib.request.Request(url_e, headers=headers)
        with urllib.request.urlopen(req_e) as resp_e:
            events = json.loads(resp_e.read().decode())
        print(f"  Eventos do lead ({len(events)}):")
        for ev in events:
            print(f"    • [{ev.get('created_at')[:19]}] {ev.get('event_type')}: {ev.get('description')}")
