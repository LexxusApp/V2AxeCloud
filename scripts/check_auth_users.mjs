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
  console.log("Total auth users:", users.length);
  
  // Find all auth users that do NOT start with f_ (i.e. not filhos)
  const nonFilhos = users.filter(u => !u.email.startsWith("f_"));
  console.log("Total non-filho users in auth:", nonFilhos.length);
  for (const u of nonFilhos) {
    console.log(`[${u.created_at}] id: ${u.id} | email: ${u.email} | meta: ${JSON.stringify(u.user_metadata)}`);
  }
}
run();
