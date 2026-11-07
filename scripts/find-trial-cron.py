from pathlib import Path

for p in Path("api").rglob("*.ts"):
    try:
        txt = p.read_text(encoding="utf-8")
        if "trial_nurture" in txt or "trial" in txt.lower() and "pix" in txt.lower():
            print("Found in:", p)
    except Exception:
        pass
