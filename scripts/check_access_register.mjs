import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.trim().startsWith("#")) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/\r/g, "");
  }
}

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: logs, error } = await sb.from('access_logs')
    .select('*')
    .gte('created_at', '2026-10-26T00:00:00Z')
    .ilike('event_type', '%register%');
  console.log('Register access logs today:', logs?.length);
  for (const l of logs || []) {
    console.log(l.created_at, l.event_type, l.metadata);
  }

  // Also check if there are any other auth events
  const { data: allAccess } = await sb.from('access_logs')
    .select('*')
    .gte('created_at', '2026-10-26T00:00:00Z')
    .ilike('event_type', '%auth%');
  console.log('Auth access logs today:', allAccess?.length);
  for (const a of allAccess || []) {
    console.log(a.created_at, a.event_type, a.metadata);
  }
}
run();
