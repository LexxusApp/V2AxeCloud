#!/usr/bin/env python3
"""Atualiza apenas IDs Meta no .env (sem tocar no token)."""
from pathlib import Path

ENV_PATH = Path("/opt/axecloud/.env")
UPDATES = {
    "WA_BUSINESS_ACCOUNT_ID": "27078466415169002",
    "WA_PHONE_NUMBER_ID": "1194550570409303",
}


def main() -> None:
    text = ENV_PATH.read_text(errors="ignore")
    seen: set[str] = set()
    out: list[str] = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        key = line.split("=", 1)[0].strip()
        if key in UPDATES:
            out.append(f"{key}={UPDATES[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, value in UPDATES.items():
        if key not in seen:
            out.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(out) + "\n")
    print("UPDATED=WA_BUSINESS_ACCOUNT_ID,WA_PHONE_NUMBER_ID")
    print("PHONE_ID=1194550570409303")
    print("WABA_ID=27078466415169002")


if __name__ == "__main__":
    main()
