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
  
  const unconfirmed = users.filter(u => !u.email_confirmed_at);
  console.log("Unconfirmed users count:", unconfirmed.length);
  for (const u of unconfirmed) {
    console.log(`[${u.created_at}] email: ${u.email} | meta: ${JSON.stringify(u.user_metadata)}`);
  }
}
run();
