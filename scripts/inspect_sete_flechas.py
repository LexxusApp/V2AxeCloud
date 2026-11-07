import json
import urllib.request
import urllib.parse
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

sb_url = env.get('VITE_SUPABASE_URL')
sb_key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('VITE_SUPABASE_ANON_KEY')

q = urllib.parse.quote('casa-de-jurema-caboclo-das-sete-flechas-e-tenda-de-umbanda-pai-malaquias-da-bahia')
url = f"{sb_url}/rest/v1/diretorio_terreiros?slug=eq.{q}&select=*"
headers = {
    "apikey": sb_key,
    "Authorization": f"Bearer {sb_key}"
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())

print(f"Encontrados: {len(data)}")
for r in data:
    print("ID:", r.get("id"))
    print("Nome:", r.get("nome"))
    print("Slug:", r.get("slug"))
    print("foto_url:", r.get("foto_url"))
    print("fotos:", r.get("fotos"))
    print("fotos_google:", r.get("fotos_google"))
    print("galeria_fotos:", r.get("galeria_fotos"))

for r in res.data:
    print("ID:", r.get("id"))
    print("Nome:", r.get("nome"))
    print("Slug:", r.get("slug"))
    print("foto_url:", r.get("foto_url"))
    print("fotos:", r.get("fotos"))
    print("fotos_google:", r.get("fotos_google"))
    print("galeria_fotos:", r.get("galeria_fotos"))
    print("-" * 50)
