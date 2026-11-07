import os, json, urllib.request
from dotenv import load_dotenv
load_dotenv('.env')

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
anon = os.environ.get('VITE_SUPABASE_ANON_KEY')
email = 'tenda.umbanda.oca@gmail.com'

# 1. Generate magic link for Joyce
headers_admin = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
req_magic = urllib.request.Request(
    f'{url}/auth/v1/admin/generate_link',
    data=json.dumps({'type': 'magiclink', 'email': email}).encode(),
    headers=headers_admin
)
with urllib.request.urlopen(req_magic) as resp:
    magic_res = json.loads(resp.read().decode())
    token_hash = magic_res.get('hashed_token')
    print('Token hash obtained:', bool(token_hash))

# 2. Verify OTP to get access_token
headers_anon = {'apikey': anon, 'Authorization': f'Bearer {anon}', 'Content-Type': 'application/json'}
req_verify = urllib.request.Request(
    f'{url}/auth/v1/verify',
    data=json.dumps({'token_hash': token_hash, 'type': 'magiclink'}).encode(),
    headers=headers_anon
)
with urllib.request.urlopen(req_verify) as resp:
    verify_res = json.loads(resp.read().decode())
    access_token = verify_res.get('access_token')
    print('Access token obtained:', bool(access_token))

# 3. Call production checkout EFI PIX endpoint
req_checkout = urllib.request.Request(
    'https://axecloud.com.br/api/v1/checkout/efi/pix',
    data=json.dumps({
        'purpose': 'renewal',
        'billingCycle': 'monthly',
        'payerName': 'Joyce Nugerini'
    }).encode(),
    headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req_checkout) as resp:
        checkout_res = json.loads(resp.read().decode())
        print('Checkout SUCCESS!')
        print('txid:', checkout_res.get('txid'))
        print('pixCopiaECola:', checkout_res.get('pixCopiaECola') or checkout_res.get('copyPaste') or checkout_res.get('qrcodeText'))
        print('Keys:', list(checkout_res.keys()))
        print('Full data:', json.dumps(checkout_res, indent=2))
except urllib.error.HTTPError as e:
    print('Checkout error:', e.code, e.read().decode())
