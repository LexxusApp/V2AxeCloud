#!/usr/bin/env python3
"""Upsert WA_META_TEMPLATE_FALHA_ACESSO_ZELADOR no .env local."""
from pathlib import Path

ENV_PATH = Path(".env")
NEED = {
    "WA_META_TEMPLATE_FALHA_ACESSO_ZELADOR": "conta_membro_aviso_zelador_axc",
}


def main() -> None:
    text = ENV_PATH.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        key = line.split("=", 1)[0].strip()
        if key in NEED:
            out.append(f"{key}={NEED[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, val in NEED.items():
        if key not in seen:
            out.append(f"{key}={val}")
            print(f"ADDED {key}")
        else:
            print(f"UPDATED {key}")
    ENV_PATH.write_text("\n".join(out) + ("\n" if text.endswith("\n") else ""), encoding="utf-8")


if __name__ == "__main__":
    main()
