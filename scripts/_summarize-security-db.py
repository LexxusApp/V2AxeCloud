#!/usr/bin/env python3
import json
from pathlib import Path

d = json.loads(Path("/tmp/security-db.json").read_text(encoding="utf-8"))
print("admin_at_admin", len(d.get("admin_at_admin_attempts") or []))
print("admin_star", len(d.get("admin_star_attempts") or []))
print("attacker", json.dumps(d.get("attacker_ips"), ensure_ascii=False)[:2000])
print("top_fail_24", json.dumps(d.get("top_failed_emails_24h"), ensure_ascii=False)[:1500])
print("top_ip_24", json.dumps(d.get("top_ips_by_failure_24h"), ensure_ascii=False)[:1500])
print("real", d.get("real_account_check", {}).get("is_real_account_admin_at_admin"))
print("counts", json.dumps(d.get("counts"), ensure_ascii=False))
print("notes", json.dumps(d.get("reading_notes_tech"), ensure_ascii=False)[:1500])
# dump timestamps for correlation
stamps = [e.get("timestamp_sp") for e in (d.get("admin_at_admin_attempts") or []) if e.get("timestamp_sp")]
Path("/tmp/_admin_admin_timestamps.json").write_text(json.dumps(stamps), encoding="utf-8")
print("stamps", len(stamps))
for e in (d.get("admin_at_admin_attempts") or [])[:20]:
    print("EVT", json.dumps({k: e.get(k) for k in ("timestamp_sp","email_tried","success","fail","ip","user_agent","path_mode","action","status")}, ensure_ascii=False))
