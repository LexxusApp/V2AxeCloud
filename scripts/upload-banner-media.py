#!/usr/bin/env python3
import urllib.request
import os
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

def main():
    env = load_env()
    token = env["WA_META_TOKEN"]
    phone_id = env["WA_PHONE_NUMBER_ID"]
    ver = env.get("WA_BUSINESS_VERSION", "v21.0")

    file_path = "public/banner-assinatura-pix.jpg"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    body = []
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="messaging_product"')
    body.append(b"")
    body.append(b"whatsapp")
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="file"; filename="banner-assinatura-pix.jpg"')
    body.append(b"Content-Type: image/jpeg")
    body.append(b"")
    body.append(file_bytes)
    body.append(f"--{boundary}--".encode())
    body.append(b"")

    payload = b"\r\n".join(body)

    req = urllib.request.Request(
        f"https://graph.facebook.com/{ver}/{phone_id}/media",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        },
        method="POST"
    )

    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print("Media uploaded successfully:", res)
        return res.get("id")

if __name__ == "__main__":
    main()
