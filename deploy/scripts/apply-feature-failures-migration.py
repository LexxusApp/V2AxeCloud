#!/usr/bin/env python3
"""Aplica a migration tenant_feature_failures via psql se DATABASE_URL existir."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ENV = Path(".env")
SQL = Path("supabase/migrations/20260907010000_tenant_feature_failures.sql")


def load_env() -> dict[str, str]:
    out = {}
    for line in ENV.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main() -> int:
    env = load_env()
    db = (
        env.get("DATABASE_URL")
        or env.get("SUPABASE_DB_URL")
        or env.get("POSTGRES_URL")
        or ""
    )
    if not db:
        print("NO_DATABASE_URL — aplique a migration no Supabase SQL editor:")
        print(SQL)
        return 2
    if not SQL.exists():
        print("MISSING_SQL", SQL)
        return 1
    r = subprocess.run(
        ["psql", db, "-v", "ON_ERROR_STOP=1", "-f", str(SQL)],
        capture_output=True,
        text=True,
    )
    print(r.stdout)
    print(r.stderr)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
