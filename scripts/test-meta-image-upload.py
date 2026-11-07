import json
import os
import sys
import urllib.request
import urllib.error

def load_env(path):
    env = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env

env = load_env("AxecloudV2/.env")
token = env["WA_META_TOKEN"]
waba = env["WA_BUSINESS_ACCOUNT_ID"]

img_path = "AxecloudV2/public/og-image.png"
img_size = os.path.getsize(img_path)
print(f"Image path: {img_path}, size: {img_size} bytes")

# 1. Inspect app id from token using /debug_token or /me
req_me = urllib.request.Request(
    f"https://graph.facebook.com/v21.0/me?access_token={token}"
)
try:
    with urllib.request.urlopen(req_me) as resp:
        print("Me:", resp.read().decode())
except Exception as e:
    print("Me error:", e)

# 2. Try creating upload session
app_id = "app"
upload_session_url = f"https://graph.facebook.com/v21.0/app/uploads?file_length={img_size}&file_type=image/png&access_token={token}"
req_upload = urllib.request.Request(upload_session_url, method="POST")
try:
    with urllib.request.urlopen(req_upload) as resp:
        session_data = json.loads(resp.read().decode())
        print("Upload session data:", session_data)
        upload_id = session_data.get("id")
except urllib.error.HTTPError as e:
    print("Upload session HTTP error:", e.code, e.read().decode())
    upload_id = None
except Exception as e:
    print("Upload session error:", e)
    upload_id = None

if upload_id:
    # 3. Upload file content to session
    with open(img_path, "rb") as f:
        img_bytes = f.read()
    
    upload_url = f"https://graph.facebook.com/v21.0/{upload_id}"
    req_file = urllib.request.Request(upload_url, data=img_bytes, method="POST")
    req_file.add_header("Authorization", f"OAuth {token}")
    req_file.add_header("file_offset", "0")
    req_file.add_header("Content-Type", "image/png")
    
    try:
        with urllib.request.urlopen(req_file) as resp:
            file_res = json.loads(resp.read().decode())
            print("File upload res:", file_res)
            file_handle = file_res.get("h")
            print("File handle (h):", file_handle)
    except urllib.error.HTTPError as e:
        print("File upload HTTP error:", e.code, e.read().decode())
    except Exception as e:
        print("File upload error:", e)
