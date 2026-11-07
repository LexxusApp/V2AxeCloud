import json
import urllib.request
from datetime import datetime, timezone, timedelta

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
url = env.get("VITE_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": key, "Authorization": f"Bearer {key}"}

def query(endpoint):
    req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

print("=" * 65)
print("  AUDITORIA DE USO E ATIVIDADE REAL NO SISTEMA AXECLOUD")
print("=" * 65)

today_iso = "2026-10-14T00:00:00Z"
yesterday_iso = "2026-10-13T00:00:00Z"

# 1. AUDIT_LOGS (Ações de usuários, logins, alterações, disparos)
print("\n[1] AUDIT_LOGS (Ações explícitas de usuários):")
try:
    logs = query(f"audit_logs?created_at=gte.{yesterday_iso}&order=created_at.desc&limit=30")
    print(f"  Total de eventos encontrados desde ontem: {len(logs)}")
    for l in logs:
        action = l.get("action")
        user = l.get("user_email") or l.get("user_id") or "Anônimo"
        meta = l.get("metadata") or {}
        ip = l.get("ip_address")
        created = l.get("created_at")
        print(f"  • [{created}] Ação: {action} | Usuário: {user} | IP: {ip}")
        if meta and isinstance(meta, dict):
            # Print brief metadata
            snippet = {k: v for k, v in meta.items() if k not in ('password', 'token')}
            print(f"    Meta: {json.dumps(snippet, ensure_ascii=False)[:120]}")
except Exception as e:
    print(f"  Erro ao ler audit_logs: {e}")

# 2. FILHOS DE SANTO CADASTRADOS OU ATUALIZADOS RECENTEMENTE
print("\n[2] CADASTROS / ALTERAÇÕES DE FILHOS DE SANTO:")
try:
    filhos = query(f"filhos_santo?updated_at=gte.{yesterday_iso}&order=updated_at.desc&limit=15")
    print(f"  Total atualizados/criados desde ontem: {len(filhos)}")
    for f in filhos:
        print(f"  • [{f.get('updated_at')}] Nome: {f.get('nome')} | Terreiro ID: {f.get('tenant_id') or f.get('terreiro_id')} | Status: {f.get('status')}")
except Exception as e:
    print(f"  Nota filhos_santo: {e}")

# 3. GIRAS OU EVENTOS CRIADOS/ATUALIZADOS
print("\n[3] GIRAS / EVENTOS LITÚRGICOS:")
try:
    giras = query(f"giras?updated_at=gte.{yesterday_iso}&order=updated_at.desc&limit=10")
    print(f"  Giras movimentadas desde ontem: {len(giras)}")
    for g in giras:
        print(f"  • [{g.get('updated_at')}] Título: {g.get('titulo') or g.get('nome')} | Data: {g.get('data')} | Terreiro: {g.get('tenant_id')}")
except Exception as e:
    try:
        eventos = query(f"eventos?updated_at=gte.{yesterday_iso}&order=updated_at.desc&limit=10")
        print(f"  Eventos movimentados desde ontem: {len(eventos)}")
        for ev in eventos:
            print(f"  • [{ev.get('updated_at')}] Título: {ev.get('titulo')} | Data: {ev.get('data')} | Terreiro: {ev.get('tenant_id')}")
    except Exception as e2:
        print(f"  Nota giras/eventos: {e2}")

# 4. TELEMETRIA DE ROTAS DOS TERREIROS (TENANT_FEATURE_FAILURES - INCLUINDO AUTO-RESOLVIDAS)
print("\n[4] NAVEGAÇÃO E TELEMETRIA DE TERREIROS (ÚLTIMAS 24H):")
try:
    failures = query(f"tenant_feature_failures?created_at=gte.{yesterday_iso}&order=created_at.desc&limit=15")
    print(f"  Interações registradas por líderes/filhos nas telas: {len(failures)}")
    for tf in failures:
        tenant = tf.get("tenant_id") or "Sem tenant"
        user_info = tf.get("user_email") or tf.get("user_id") or "Sem user"
        feature = tf.get("feature")
        route = tf.get("route")
        status = tf.get("http_status")
        msg = tf.get("error_message") or "OK"
        print(f"  • [{tf.get('created_at')}] Tela/Módulo: {feature} ({route}) | HTTP: {status} | User: {user_info} | Tenant: {tenant}")
except Exception as e:
    print(f"  Nota telemetria: {e}")

# 5. ULTIMOS LOGINS DE ZELADORES (PERFIL_LIDER)
print("\n[5] ÚLTIMA ATIVIDADE REGISTRADA DOS LÍDERES:")
try:
    perfis = query("perfil_lider?select=id,nome_terreiro,zelador,email,updated_at&order=updated_at.desc&limit=8")
    for p in perfis:
        print(f"  • {p.get('zelador')} ({p.get('nome_terreiro')}): {p.get('email')} - Atualizado: {p.get('updated_at')}")
except Exception as e:
    print(f"  Nota perfil_lider: {e}")
