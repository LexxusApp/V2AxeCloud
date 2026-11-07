from pathlib import Path

content = Path("api/lib/cronWhatsAppJobs.ts").read_text(encoding="utf-8")
for i, line in enumerate(content.splitlines(), start=1):
    if "runsubscriptionbillingreminders" in line.lower() or "billingreminders" in line.lower():
        print(f"{i}: {line}")
