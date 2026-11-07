import json
import urllib.request
import os
import sys
import base64

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

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
gemini_key = env.get("GEMINI_API_KEY")
if not gemini_key:
    print("GEMINI_API_KEY não encontrada.")
    sys.exit(1)

audio_files = [
    "scripts/valdety_audio_1136061902724187.ogg",
    "scripts/valdety_audio_3360422947679930.ogg"
]

for af in audio_files:
    if not os.path.exists(af):
        print(f"Arquivo {af} não existe.")
        continue
    with open(af, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [{
            "parts": [
                {"text": "Transcreva este áudio em português com exatidão:"},
                {
                    "inline_data": {
                        "mime_type": "audio/ogg",
                        "data": b64
                    }
                }
            ]
        }]
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            print(f"\n--- Transcrição de {af} ---")
            print(text.strip())
    except Exception as e:
        print(f"Erro ao transcrever {af}: {e}")
