#!/usr/bin/env python3
import urllib.request
import json
import time
import sys
import subprocess

TEMPLATE_ID = "1408227897958203"

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
    
    print("Aguardando aprovação da Meta para o template com imagem...", flush=True)
    for i in range(100):
        req = urllib.request.Request(
            f"https://graph.facebook.com/v21.0/{TEMPLATE_ID}?fields=name,status,rejected_reason",
            headers={"Authorization": f"Bearer {token}"}
        )
        try:
            with urllib.request.urlopen(req) as resp:
                d = json.loads(resp.read().decode())
                st = d.get("status")
                print(f"[{i+1}/100] Status: {st}", flush=True)
                if st == "APPROVED":
                    print("TEMPLATE APROVADO! Disparando mensagem com banner para Lucas...", flush=True)
                    subprocess.run([sys.executable, "scripts/send-lucas-order-img-pix.py"])
                    return 0
                elif st == "REJECTED":
                    print("TEMPLATE REJEITADO PELA META:", d.get("rejected_reason"), flush=True)
                    return 1
        except Exception as e:
            print(f"Erro ao consultar: {e}", flush=True)
        time.sleep(20)
    
    print("Tempo limite de espera atingido. Template ainda pendente.", flush=True)
    return 0

if __name__ == "__main__":
    main()
