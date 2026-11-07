import json

with open('_audit_active_tenants.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total Terreiros: {len(data)}")

def score(r):
    s = 0
    if r['totalFilhos'] >= 5: s += 35
    elif r['totalFilhos'] >= 1: s += 20
    if r['totalGiras'] >= 1: s += 20
    if r['totalWaLogs'] >= 2: s += 20
    if r['hasPhoto']: s += 10
    if r['termsAccepted']: s += 15
    return s

for r in data:
    r['score'] = score(r)

high = [r for r in data if r['score'] >= 60]
med = [r for r in data if 30 <= r['score'] < 60]
low = [r for r in data if r['score'] < 30]

print(f"\n=======================================================")
print(f"ALTA PROBABILIDADE DE CONVERSÃO / RETENÇÃO: {len(high)} ({len(high)*100//len(data)}%)")
print(f"=======================================================")
for h in sorted(high, key=lambda x: -x['score']):
    print(f"- {h['nomeTerreiro']}")
    print(f"  Zelador: {h['zelador']} | WA: {h['whatsapp']} | Criado: {h['createdAt'][:10]}")
    print(f"  Filhos: {h['totalFilhos']} | Disparos WA: {h['totalWaLogs']} | Foto: {h['hasPhoto']} | Pix: {h['pixConfigurado']} | Score: {h['score']}/100")

print(f"\n=======================================================")
print(f"MÉDIA PROBABILIDADE (EM TESTE / DEPENDEM DE ONBOARDING): {len(med)} ({len(med)*100//len(data)}%)")
print(f"=======================================================")
for m in sorted(med, key=lambda x: -x['score']):
    print(f"- {m['nomeTerreiro']}")
    print(f"  Zelador: {m['zelador']} | WA: {m['whatsapp']} | Criado: {m['createdAt'][:10]}")
    print(f"  Filhos: {m['totalFilhos']} | Disparos WA: {m['totalWaLogs']} | Foto: {m['hasPhoto']} | Pix: {m['pixConfigurado']} | Score: {m['score']}/100")

print(f"\n=======================================================")
print(f"BAIXA PROBABILIDADE / CONTA ABANDONADA OU SEM USO: {len(low)} ({len(low)*100//len(data)}%)")
print(f"=======================================================")
for l in sorted(low, key=lambda x: -x['score']):
    print(f"- {l['nomeTerreiro']}")
    print(f"  Zelador: {l['zelador']} | WA: {l['whatsapp']} | Criado: {l['createdAt'][:10]}")
    print(f"  Filhos: {l['totalFilhos']} | Disparos WA: {l['totalWaLogs']} | Score: {l['score']}/100")
