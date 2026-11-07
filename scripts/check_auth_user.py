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
sb_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

req = urllib.request.Request(f"{sb_url}/auth/v1/admin/users/3b0bac5d-93fd-4612-a0ef-00f41104593b", headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        user = json.loads(resp.read().decode())
        print("User found:", user.get("email"), user.get("id"))
except Exception as e:
    print("Error:", e)
