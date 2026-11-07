from pathlib import Path

for p in Path(".").rglob("*"):
    if p.suffix in (".ts", ".js", ".py") and "node_modules" not in str(p) and "dist" not in str(p):
        try:
            txt = p.read_text(encoding="utf-8")
            if "cobranca_assinatura_pix" in txt or "cobranca_assinatura" in txt:
                print("cobranca_assinatura in:", p)
        except Exception:
            pass
