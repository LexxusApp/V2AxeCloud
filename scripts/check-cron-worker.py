from pathlib import Path

content = Path("cloudflare/api-container-worker.ts").read_text(encoding="utf-8")
for i, line in enumerate(content.splitlines(), start=1):
    if "scheduled" in line.lower() or "cron" in line.lower():
        print(f"{i}: {line}")
