import urllib.request
import json

env = dict(l.strip().split('=', 1) for l in open('.env', encoding='utf-8') if '=' in l and not l.strip().startswith('#'))
token = env['WA_META_TOKEN'].strip()

media_id = "2804084233296230"
url = f"https://graph.facebook.com/v21.0/{media_id}"
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print("Media Info:", data)
        media_url = data.get('url')
        if media_url:
            req_bin = urllib.request.Request(media_url, headers={'Authorization': f'Bearer {token}'})
            with urllib.request.urlopen(req_bin) as r_bin:
                img_data = r_bin.read()
                with open("scripts/alex_puntel_image.jpg", "wb") as f_out:
                    f_out.write(img_data)
                print(f"Imagem salva em scripts/alex_puntel_image.jpg ({len(img_data)} bytes)")
except Exception as e:
    print("Erro ao baixar midia:", e)
