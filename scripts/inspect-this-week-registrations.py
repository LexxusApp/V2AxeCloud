import urllib.request
import json

lines = open('.env', encoding='utf-8').read().splitlines()
env = dict([l.strip().split('=', 1) for l in lines if l.strip() and not l.startswith('#') and '=' in l])
url = env.get('VITE_SUPABASE_URL')
key = env.get('SUPABASE_SERVICE_ROLE_KEY')

headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

req = urllib.request.Request(
    f"{url}/rest/v1/perfil_lider?select=id,created_at,nome_terreiro,cargo,email,whatsapp,cidade&created_at=gte.2026-10-02T00:00:00Z&order=created_at.desc",
    headers=headers
)
res = json.loads(urllib.request.urlopen(req).read().decode())

print(f"Total de terreiros cadastrados nesta semana: {len(res)}\n")

for t in res:
    tid = t['id']
    # filhos count
    f_req = urllib.request.Request(
        f"{url}/rest/v1/filhos_de_santo?tenant_id=eq.{tid}&select=count",
        headers={**headers, 'Prefer': 'count=exact'}
    )
    f_res = urllib.request.urlopen(f_req)
    filhos_count = f_res.headers.get('Content-Range', '').split('/')[-1]

    # giras count
    g_req = urllib.request.Request(
        f"{url}/rest/v1/calendario_axe?tenant_id=eq.{tid}&select=count",
        headers={**headers, 'Prefer': 'count=exact'}
    )
    try:
        g_res = urllib.request.urlopen(g_req)
        giras_count = g_res.headers.get('Content-Range', '').split('/')[-1]
    except Exception:
        giras_count = '0'

    # whatsapp logs
    wa_req = urllib.request.Request(
        f"{url}/rest/v1/whatsapp_logs?tenant_id=eq.{tid}&select=tipo,status,created_at&order=created_at.desc&limit=5",
        headers=headers
    )
    wa_logs = json.loads(urllib.request.urlopen(wa_req).read().decode())
    wa_summary = [f"{w['tipo']} ({w['status']})" for w in wa_logs]

    # subscription
    sub_req = urllib.request.Request(
        f"{url}/rest/v1/subscriptions?id=eq.{tid}&select=status,plan,expires_at",
        headers=headers
    )
    sub = json.loads(urllib.request.urlopen(sub_req).read().decode())
    sub_info = sub[0] if sub else {}

    print(f"• Terreiro: {t.get('nome_terreiro')}")
    print(f"  Zelador(a): {t.get('cargo')} | Cidade: {t.get('cidade')}")
    print(f"  WhatsApp: {t.get('whatsapp')} | E-mail: {t.get('email')}")
    print(f"  Cadastrado em: {t.get('created_at', '')[:16]}")
    print(f"  Plano/Assinatura: {sub_info.get('status', 'trial')} ({sub_info.get('plan', 'premium')}) - Expira: {sub_info.get('expires_at', '')[:10]}")
    print(f"  Uso do sistema: {filhos_count} filhos cadastrados | {giras_count} giras agendadas")
    print(f"  Disparos WhatsApp recebidos: {len(wa_logs)} -> {wa_summary}")
    print("-" * 60)
