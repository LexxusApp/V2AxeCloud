with open('src/views/PerfilFilho.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'pix-config?tenantId=' in line and 'authFetch' in line:
        lines[i] = '          const pixRes = await authFetch(`/api/v1/financial/pix-config?tenantId=${encodeURIComponent(tenantId)}`);\n'
    if 'new RegExp' in line and 'ID:' in line:
        lines[i] = '          return new RegExp(`\\\\(ID:${filho.id}\\\\)`).test(String(t.descricao || ""));\n'

with open('src/views/PerfilFilho.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Updated successfully!')
