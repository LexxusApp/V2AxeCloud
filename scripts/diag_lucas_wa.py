#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request
from pathlib import Path

def load_env(p):
    d = {}
    for line in Path(p).read_text(encoding="utf-8", errors="ignore").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.strip().split("=", 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    return d

def main():
    env = load_env(".env")
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Faltam chaves do Supabase")
        return
    qs = urllib.parse.urlencode({"telefone": "like.%11920033501%", "order": "created_at.desc", "limit": "5"})
    req = urllib.request.Request(f"{url}/rest/v1/whatsapp_logs?{qs}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print("Erro Supabase:", e)

if __name__ == "__main__":
    main()
