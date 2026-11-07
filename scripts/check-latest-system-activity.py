import urllib.request
import json
import datetime
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

env = {}
with open(".env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip("'\"")

sb_url = env["VITE_SUPABASE_URL"].strip()
sb_key = env["SUPABASE_SERVICE_ROLE_KEY"].strip()
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

def get(table, query_str):
    url = f"{sb_url}/rest/v1/{table}?{query_str}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("=== ATIVIDADE RECENTE DO SISTEMA ===")
tenants = get("perfil_lider", "select=id,nome_terreiro,email,cargo,created_at&order=created_at.desc&limit=3")
print("Últimos Terreiros Cadastrados:")
for t in tenants:
    print(f"  • {t.get('nome_terreiro')} ({t.get('email')}) | Criado em: {t.get('created_at')[:19]}")

failures = get("tenant_feature_failures", "select=id,feature,severity,error_message,created_at&order=created_at.desc&limit=3")
print(f"\nÚltimas falhas registradas ({len(failures)}):")
for f in failures:
    print(f"  • [{f.get('severity')}] {f.get('feature')}: {f.get('error_message')}")

today_start = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
logs = get("access_logs", f"created_at=gte.{today_start}&select=id,event_type,created_at&order=created_at.desc&limit=5")
print(f"\nÚltimos logs de acesso hoje ({len(logs)} mostrados):")
for l in logs:
    print(f"  • [{l.get('created_at')[:19]}] {l.get('event_type')}")
