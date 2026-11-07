import urllib.request
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

login_url = f"{sb_url}/auth/v1/token?grant_type=password"
headers = {
    "apikey": sb_key,
    "Content-Type": "application/json"
}
body = {
    "email": "lucasilvasiqueira@outlook.com.br",
    "password": "AxeCloud@2026Admin"
}

req = urllib.request.Request(login_url, data=json.dumps(body).encode("utf-8"), headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print("Login OK! Access token length:", len(res.get("access_token", "")))
        print("User:", res.get("user", {}).get("email"))
except urllib.error.HTTPError as e:
    print(f"Login failed: {e.code} - {e.read().decode()}")
except Exception as e:
    print("Error:", e)
