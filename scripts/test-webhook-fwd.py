import urllib.request
import json

env = {}
with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip('\'\"')

key = env.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()

url = 'https://axecloud.com.br/api/prospecting/webhook/whatsapp'
data = json.dumps({"object": "whatsapp_business_account", "entry": []}).encode('utf-8')
headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'AxeCloud/1.0',
    'Authorization': f'Bearer {key}'
}

req = urllib.request.Request(url, data=data, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as res:
        print('Status:', res.status, res.read().decode())
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.read().decode())
except Exception as e:
    print('Error:', e)
