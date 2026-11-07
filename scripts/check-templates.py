import json
import urllib.request

def load_env(path):
    env = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('\'"')
    return env

env = load_env('AxecloudV2/.env')
token = env['WA_META_TOKEN']
waba = env['WA_BUSINESS_ACCOUNT_ID']

url = f'https://graph.facebook.com/v21.0/{waba}/message_templates?name=axecloud_prospeccao_imagem_v1'
req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(json.dumps(data, indent=2, ensure_ascii=False))


