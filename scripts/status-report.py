import os, json
import psycopg2
from dotenv import load_dotenv

load_dotenv()
if not os.environ.get('DATABASE_URL'):
    load_dotenv('api/.env')
if not os.environ.get('DATABASE_URL'):
    load_dotenv('../.env')

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print(json.dumps({"error": "DATABASE_URL not found"}))
    exit(1)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute('SELECT count(*) FROM tenants;')
tenants_count = cur.fetchone()[0]

cur.execute("""
    SELECT name, created_at, plan, active 
    FROM tenants 
    ORDER BY created_at DESC 
    LIMIT 5;
""")
recent_tenants = [
    {"name": r[0], "created_at": r[1].isoformat() if r[1] else None, "plan": r[2], "active": r[3]} 
    for r in cur.fetchall()
]

cur.execute("""
    SELECT status, count(*) 
    FROM prospecting_leads 
    GROUP BY status;
""")
leads_by_status = dict(cur.fetchall())

cur.execute("""
    SELECT count(*) 
    FROM admin_whatsapp_messages 
    WHERE created_at >= CURRENT_DATE;
""")
msgs_today = cur.fetchone()[0]

cur.execute("""
    SELECT direction, count(*) 
    FROM admin_whatsapp_messages 
    WHERE created_at >= CURRENT_DATE 
    GROUP BY direction;
""")
msgs_direction_today = dict(cur.fetchall())

cur.execute("""
    SELECT count(*) 
    FROM subscriptions 
    WHERE status = 'active';
""")
active_subs = cur.fetchone()[0]

# Check latest messages received in last 2 hours
cur.execute("""
    SELECT phone_number, direction, content, created_at
    FROM admin_whatsapp_messages
    WHERE created_at >= NOW() - INTERVAL '2 hours'
    ORDER BY created_at DESC
    LIMIT 10;
""")
recent_msgs = [
    {"phone": r[0], "direction": r[1], "content": (r[2][:60] if r[2] else ""), "created_at": r[3].isoformat() if r[3] else None}
    for r in cur.fetchall()
]

print(json.dumps({
    "tenants_total": tenants_count,
    "recent_tenants": recent_tenants,
    "leads_by_status": leads_by_status,
    "msgs_today": msgs_today,
    "msgs_direction_today": msgs_direction_today,
    "active_subs": active_subs,
    "recent_msgs": recent_msgs
}, indent=2, ensure_ascii=False))

cur.close()
conn.close()
