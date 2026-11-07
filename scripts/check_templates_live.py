import json
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

token = env.get('WA_META_TOKEN')
waba = env.get('WA_BUSINESS_ACCOUNT_ID')

url = f"https://graph.facebook.com/v21.0/{waba}/message_templates?limit=10"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
    templates = data.get("data", [])
    print(f"Top {len(templates)} templates mais recentes na Meta:\n")
    for t in templates:
        name = t.get("name")
        status = t.get("status")
        cat = t.get("category")
        tid = t.get("id")
        print(f"• Nome: {name}")
        print(f"  Status: {status}")
        print(f"  Categoria: {cat}")
        print(f"  ID: {tid}")
        for c in t.get("components", []):
            print(f"    Componente {c.get('type')}:")
            if c.get("text"):
                print(f"      Texto: {c.get('text')}")
            if c.get("buttons"):
                for b in c.get("buttons"):
                    print(f"      Botão: {b}")
        print("-" * 50)
except Exception as e:
    print("Erro ao consultar Meta:", e)
