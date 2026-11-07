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
  const { data: usersData } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users || [];
  
  // Group by role or meta
  for (const u of users) {
    if (u.user_metadata?.role !== 'filho' && u.email.startsWith('f_')) {
      console.log('Strange f_ user without role filho:', u.id, u.email, u.user_metadata);
    }
    if (!u.email.startsWith('f_') && u.user_metadata?.role === 'filho') {
      console.log('Filho user without f_ prefix:', u.id, u.email, u.user_metadata);
    }
  }

  // Let's check when the users were created today
  const today = users.filter(u => u.created_at.startsWith('2026-10-26'));
  console.log('Total auth users created TODAY (2026-10-26):', today.length);
  for (const t of today) {
    console.log(`[${t.created_at}] email: ${t.email} | meta: ${JSON.stringify(t.user_metadata)}`);
  }
}
run();
