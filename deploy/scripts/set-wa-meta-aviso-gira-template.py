#!/usr/bin/env python3
"""Atualiza WA_META_TEMPLATE_AVISO_GIRA no .env local."""
from pathlib import Path

ENV_PATH = Path(".env")
KEY = "WA_META_TEMPLATE_AVISO_GIRA"
VALUE = "aviso_gira_lembrete_membro_axecloud"


def main() -> None:
    text = ENV_PATH.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    out: list[str] = []
    seen = False
    for line in lines:
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        k = line.split("=", 1)[0].strip()
        if k == KEY:
            out.append(f"{KEY}={VALUE}")
            seen = True
        else:
            out.append(line)
    if not seen:
        out.append(f"{KEY}={VALUE}")
    ENV_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"SET {KEY}={VALUE}")


if __name__ == "__main__":
    main()
