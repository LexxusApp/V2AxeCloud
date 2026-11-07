from pathlib import Path

content = Path("api/index.ts").read_text(encoding="utf-8")
for i, line in enumerate(content.splitlines(), start=1):
    if "/api/cron" in line or "whatsappcron" in line.lower() or "runwhatsappcronjobs" in line.lower():
        print(f"{i}: {line}")
