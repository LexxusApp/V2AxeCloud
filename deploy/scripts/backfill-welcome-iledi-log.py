#!/usr/bin/env python3
"""Backfill whatsapp_logs do boas-vindas do terreiro Iledi (envio sem log)."""
import json
import urllib.request
from pathlib import Path

env = {}
for line in Path(".env").read_text(encoding="utf-8", errors="ignore").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

url = (env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL") or "").rstrip("/")
key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_KEY") or ""

row = {
    "tenant_id": "dabc954f-2f90-4c2e-b235-35569c145059",
    "filho_id": None,
    "tipo": "boas_vindas_zelador",
    "telefone": "5546999108531",
    "mensagem": (
        "Boas-vindas zelador: Guilherme Alves · Iledi · gabriela.antunes92@hotmail.com · "
        "template boas_vindas_zelador_v2_axecloud · backfill (envio Meta sem log)"
    ),
    "status": "sent",
    "external_id": "wamid.HBgMNTU0Njk5MTA4NTMxFQIAERgSQkU3RDAwNDE0MEM0QjIzOTRFAA==",
}

req = urllib.request.Request(
    f"{url}/rest/v1/whatsapp_logs",
    data=json.dumps(row).encode("utf-8"),
    method="POST",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("OK", r.read().decode()[:500])
except Exception as e:
    if hasattr(e, "read"):
        print("FAIL", e.code, e.read().decode()[:500])
    else:
        print("FAIL", e)
