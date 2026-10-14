import sys
import os
import time
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def load_env(path=".env"):
    env = {}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass
    return env

env = load_env()
sb_url = os.environ.get("VITE_SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
critical_failures = 0

print("=" * 60)
print("  RELATORIO REAL-TIME DE ACOMPANHAMENTO DO SISTEMA AXECLOUD")
print(f"  Data/Hora: {datetime.now(timezone(timedelta(hours=-3))).strftime('%Y-%m-%d %H:%M:%S')} (America/Sao_Paulo)")
print("=" * 60)

# 1. ENDPOINTS HTTP DE PRODUÇÃO
print("\n[1] CHECAGEM DE ENDPOINTS HTTP EM PRODUCAO:")
endpoints = [
    ("Home Landing", "https://axecloud.com.br/"),
    ("Login App", "https://axecloud.com.br/entrar"),
    ("Registro App (/register)", "https://axecloud.com.br/register"),
    ("Registro Alias (/cadastro)", "https://axecloud.com.br/cadastro"),
    ("API Health (Edge)", "https://axecloud.com.br/api/health"),
    ("API Health-Check (Edge)", "https://axecloud.com.br/api/health-check"),
    ("API Ping", "https://axecloud.com.br/api/ping"),
    ("API Plans", "https://axecloud.com.br/api/plans"),
]

for name, url in endpoints:
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AxeCloud-RealtimeMonitor/2.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            dur = (time.time() - t0) * 1000
            if resp.status == 200:
                print(f"  - {name} ({url}): HTTP {resp.status} em {dur:.1f}ms [OK]")
            else:
                print(f"  - {name} ({url}): HTTP {resp.status} em {dur:.1f}ms [ALERTA]")
                critical_failures += 1
    except urllib.error.HTTPError as e:
        dur = (time.time() - t0) * 1000
        print(f"  - {name} ({url}): HTTP {e.code} ({e.reason}) em {dur:.1f}ms [ALERTA]")
        critical_failures += 1
    except Exception as e:
        dur = (time.time() - t0) * 1000
        print(f"  - {name} ({url}): ERRO {e} em {dur:.1f}ms [FALHA]")
        critical_failures += 1

def check_supabase(url: str, key: str):
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    # 2. TABELA TENANT_FEATURE_FAILURES (AUTO-CURA E ERROS REGISTRADOS)
    print("\n[2] VERIFICANDO TENANT_FEATURE_FAILURES:")
    try:
        req = urllib.request.Request(f"{url}/rest/v1/tenant_feature_failures?select=*&order=created_at.desc&limit=10", headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            failures = json.loads(resp.read().decode())
            pending = [f for f in failures if not f.get("resolved_at")]
            print(f"  - Total de registros recentes: {len(failures)}")
            print(f"  - Falhas pendentes (não resolvidas): {len(pending)}")
            for f in failures[:5]:
                is_resolved = bool(f.get("resolved_at"))
                meta = f.get("metadata") or {}
                auto_healed = meta.get("auto_healed", False) if isinstance(meta, dict) else False
                status_label = "AUTO-CURADO" if auto_healed else ("RESOLVIDO" if is_resolved else "PENDENTE")
                print(f"    • ID {f.get('id')[:8]}... | Status: [{status_label}] | Modulo: {f.get('feature')} ({f.get('route')}) | Criado: {f.get('created_at')}")
                if f.get("error_message"):
                    print(f"      Mensagem: {f.get('error_message')[:120]}")
                if is_resolved:
                    print(f"      Resolvido em: {f.get('resolved_at')}")
    except Exception as e:
        print(f"  - Erro ao consultar tenant_feature_failures: {e}")

    # 3. WHATSAPP LOGS RECENTES (ÚLTIMAS 10 MENSAGENS)
    print("\n[3] LOGS DE WHATSAPP RECENTES:")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/whatsapp_logs?select=*&order=created_at.desc&limit=10",
            headers=headers
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            wa_logs = json.loads(resp.read().decode())
            failed_wa = [w for w in wa_logs if str(w.get('status', '')).lower() in ('failed', 'error')]
            print(f"  - Total obtido: {len(wa_logs)}")
            print(f"  - Envios com falha recente: {len(failed_wa)}")
            for log in wa_logs:
                msg_snippet = str(log.get('mensagem') or '')[:75]
                print(f"    • [{log.get('created_at')}] Tipo: {log.get('tipo')} | Tel: {log.get('telefone')} | Status: {log.get('status')}")
                print(f"      Msg: {msg_snippet}...")
    except Exception as e:
        print(f"  - Erro ao consultar whatsapp_logs: {e}")

    # 4. CONVERSAS E MENSAGENS NO ADMIN WHATSAPP (INBOUND / SUPORTE / PROSPECÇÃO)
    print("\n[4] CONVERSAS NO WHATSAPP ADMIN (CONVERSAS E RESPOSTAS):")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/admin_whatsapp_conversations?select=*&order=updated_at.desc&limit=8",
            headers=headers
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            convs = json.loads(resp.read().decode())
            print(f"  - Total de conversas ativas no admin: {len(convs)}")
            for c in convs:
                last_text = str(c.get('last_message_preview') or c.get('last_message_text') or '')[:80]
                unread = c.get('unread_count') or 0
                phone = c.get('phone_e164') or 'N/A'
                name = c.get('contact_name') or 'Desconhecido'
                print(f"    • {name} ({phone}) | Status: {c.get('status')} | Nao lidas: {unread}")
                print(f"      Ultima mensagem ({c.get('last_message_at')}): \"{last_text}\"")
    except Exception as e:
        print(f"  - Nota admin_whatsapp_conversations: {e}")

    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/growth_outreach_queue?status=eq.pendente&select=id,status,created_at&limit=5",
            headers=headers
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            pend_out = json.loads(resp.read().decode())
            print(f"  - Fila de prospecção pendente: {len(pend_out)} envios aguardando")
    except Exception as e:
        pass

    # 5. ASSINATURAS ATIVAS & STATUS DE BLOQUEIO
    print("\n[5] STATUS DAS CONTAS / ASSINATURAS:")
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/subscriptions?select=id,status,plan,expires_at,billing_cycle&order=expires_at.asc&limit=10",
            headers=headers
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            subs = json.loads(resp.read().decode())
            now_iso = datetime.now(timezone.utc).isoformat()
            expired = [s for s in subs if s.get("expires_at") and s.get("expires_at") < now_iso]
            print(f"  - Assinaturas verificadas: {len(subs)}")
            print(f"  - Expiradas: {len(expired)}")
            for s in subs[:6]:
                print(f"    • ID: {s.get('id')[:8]}... | Status: {s.get('status')} | Expira em: {s.get('expires_at')}")
    except Exception as e:
        print(f"  - Erro ao verificar subscriptions: {e}")

    # 6. VERIFICAÇÃO ESPECÍFICA DOS CASOS CRÍTICOS E NOVOS TERREIROS
    print("\n[6] VERIFICAÇÃO ESPECÍFICA DOS CASOS CRÍTICOS E NOVOS TERREIROS:")
    cases = [
        ("Mãe Joyce", "5de04732-9419-4ef5-8558-7287ed140e79"),
        ("Tata Robson", "968ae2d1-e32d-454d-9b30-05543843d8ab"),
        ("Associação Oyekundi (Yeye Apesin)", "14fcea29-a121-497a-88dc-7f93b7397ae9"),
        ("Valdety Garcia Policarpo", "7438e2e0-972f-47d8-afa4-45f33d3c8fab"),
    ]
    for nome, tid in cases:
        try:
            req_p = urllib.request.Request(f"{url}/rest/v1/perfil_lider?id=eq.{tid}&select=id,nome_terreiro,is_blocked,access_block_reason", headers=headers)
            with urllib.request.urlopen(req_p, timeout=10) as resp:
                perf = json.loads(resp.read().decode())
                p_data = perf[0] if perf else {}
            
            req_s = urllib.request.Request(f"{url}/rest/v1/subscriptions?id=eq.{tid}&select=status,expires_at", headers=headers)
            with urllib.request.urlopen(req_s, timeout=10) as resp:
                sub = json.loads(resp.read().decode())
                s_data = sub[0] if sub else {}
            
            print(f"  • {nome} ({p_data.get('nome_terreiro')}):")
            print(f"    - Bloqueado: {p_data.get('is_blocked')} (Motivo: {p_data.get('access_block_reason')})")
            print(f"    - Assinatura: {s_data.get('status')} | Validade: {s_data.get('expires_at')}")
        except Exception as e:
            print(f"  • {nome}: Erro ao consultar ({e})")

if sb_url and sb_key:
    check_supabase(sb_url, sb_key)
else:
    print("\n[INFO] VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no ambiente. Checagens profundas de banco puladas.")

print("\n" + "=" * 60)
if critical_failures > 0:
    print(f"  MONITORAMENTO CONCLUIDO COM {critical_failures} ALERTA(S)")
    print("=" * 60)
    sys.exit(1)
else:
    print("  MONITORAMENTO CONCLUIDO COM SUCESSO (100% OPERACIONAL)")
    print("=" * 60)
    sys.exit(0)
