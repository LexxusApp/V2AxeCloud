#!/usr/bin/env python3
import json
d=json.load(open("/tmp/no-login-7d.json",encoding="utf-8"))
print("gen", d["generated_sp"])
print("totals", d["totals"])
print("STALE")
for r in d["stale"]:
    print(f"- {r['days_without_login']}d | {r['nome']} | {r['zelador']} | last={r['last_login_sp']} | sess={r['last_session_sp']} | {r['email']} | internal={r['internal']}")
