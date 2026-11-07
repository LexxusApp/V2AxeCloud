from pathlib import Path

for p in Path(".").rglob("*"):
    if p.suffix in (".ts", ".tsx", ".js", ".jsx") and "node_modules" not in str(p) and "dist" not in str(p):
        try:
            txt = p.read_text(encoding="utf-8")
            if "8141" in txt:
                print("8141:", p)
            if "SALDO ATUAL DEVEDOR" in txt or "saldo atual devedor" in txt.lower():
                print("SALDO:", p)
        except Exception:
            pass
