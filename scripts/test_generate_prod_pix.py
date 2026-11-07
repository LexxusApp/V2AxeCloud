import urllib.request
import urllib.error
import json

def load_env(path=".env"):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env()
sb_url = env.get("VITE_SUPABASE_URL")
sb_key = env.get("VITE_SUPABASE_ANON_KEY")

# 1. Login as admin
login_url = f"{sb_url}/auth/v1/token?grant_type=password"
req_login = urllib.request.Request(
    login_url,
    data=json.dumps({"email": "lucasilvasiqueira@outlook.com.br", "password": "AxeCloud@2026Admin"}).encode("utf-8"),
    headers={"apikey": sb_key, "Content-Type": "application/json"}
)
with urllib.request.urlopen(req_login) as resp:
    token = json.loads(resp.read().decode())["access_token"]

# 2. Call checkout/efi/pix on production
checkout_url = "https://axecloud.com.br/api/v1/checkout/efi/pix"
body = {
    "tenantId": "3b0bac5d-93fd-4612-a0ef-00f41104593b",
    "billingCycle": "monthly",
    "purpose": "renewal"
}
req_checkout = urllib.request.Request(
    checkout_url,
    data=json.dumps(body).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 AxéCloud Admin Dispatch"
    }
)
try:
    with urllib.request.urlopen(req_checkout) as resp:
        res = json.loads(resp.read().decode())
        print("Pix Gerado na Produção:")
        print("txid:", res.get("txid"))
        print("status:", res.get("status"))
        print("amountCents:", res.get("amountCents"))
        print("copyPaste:", res.get("copyPaste")[:40] + "...")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print("Error:", e)
