import urllib.request, re

req = urllib.request.Request('https://axecloud.com.br/assets/index-DZuGEIQk.css', headers={'User-Agent': 'Mozilla/5.0'})
css = urllib.request.urlopen(req).read().decode('utf-8')

# Search for all rules affecting .library-reading-room, .inventory-pulse-board, .financial-v5-page .app-metric-rail
print('=== Rules containing library-reading-room ===')
for m in re.finditer(r'([^{}]*library-reading-room[^{}]*)\{([^}]+)\}', css):
    print(m.group(1), '-->', m.group(2))

print('\n=== Rules containing inventory-pulse-board ===')
for m in re.finditer(r'([^{}]*inventory-pulse-board[^{}]*)\{([^}]+)\}', css):
    print(m.group(1), '-->', m.group(2))

print('\n=== Rules containing financial-v5-page.*app-metric-rail ===')
for m in re.finditer(r'([^{}]*financial-v5-page[^{}]*app-metric-rail[^{}]*)\{([^}]+)\}', css):
    print(m.group(1), '-->', m.group(2))

print('\n=== Rules containing app-v5-panel affecting text colors ===')
for m in re.finditer(r'([^{}]*app-v5-panel[^{}]*)\{([^}]+)\}', css):
    sel, body = m.group(1), m.group(2)
    if 'color:' in body:
        print(sel, '-->', body)
