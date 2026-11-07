import urllib.request, re

try:
    req = urllib.request.Request('https://axecloud.com.br/dashboard', headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    css_files = re.findall(r'assets/index-[^"]+\.css', html)
    print('CSS in prod:', css_files)
    if css_files:
        css_url = 'https://axecloud.com.br/' + css_files[0]
        css = urllib.request.urlopen(urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8')
        for term in ['library-reading-room', 'inventory-pulse-board', 'app-metric-rail']:
            pos = css.find(term)
            if pos != -1:
                print(f'=== {term} in prod CSS ===')
                print(css[pos:pos+300])
            else:
                print(f'{term} not found in prod CSS')
except Exception as e:
    print('Error:', e)
