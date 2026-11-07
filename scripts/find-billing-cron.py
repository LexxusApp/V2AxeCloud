from pathlib import Path

for p in Path(".").rglob("*"):
    if p.suffix in (".ts", ".js") and "node_modules" not in str(p) and "dist" not in str(p):
        try:
            txt = p.read_text(encoding="utf-8")
            if "runSubscriptionBillingReminders" in txt:
                print("runSubscriptionBillingReminders in:", p)
        except Exception:
            pass
