import os, re

findings = []

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Check for dark backgrounds containing dark text classes or low-contrast text
                matches = re.finditer(r'className=["\']([^"\']*)["\']', content)
                for m in matches:
                    cls = m.group(1)
                    has_dark_bg = any(b in cls for b in ['bg-[#1', 'bg-[#0', 'bg-[#2', 'bg-black', 'bg-zinc-9', 'bg-neutral-9', 'bg-emerald-950', 'bg-rose-950', 'bg-amber-950', 'app-demo-empty-preview'])
                    has_dark_text = any(t in cls for t in ['text-[#64748B]', 'text-[#383127]', 'text-[#443c31]', 'text-[#6F675C]', 'text-zinc-600', 'text-gray-600', 'text-[#7F8B9C]', 'text-[#94A3B8]', 'text-gray-500'])
                    if has_dark_bg and has_dark_text:
                        findings.append((path, cls))

print(f'Total findings on same element: {len(findings)}')
for p, c in findings[:30]:
    print(f'{p}: {c[:120]}...')
