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
  const { data: leaders } = await sb.from("perfil_lider").select("id, email");
  const knownIds = new Set(leaders.map(l => l.id));
  const knownEmails = new Set(leaders.map(l => l.email));

  const { data: accessLogs } = await sb.from('access_logs').select('user_id, target_id, metadata').limit(2000);
  const unknownAccessUsers = new Set();
  for (const a of accessLogs || []) {
    if (a.user_id && !knownIds.has(a.user_id)) {
      unknownAccessUsers.add(a.user_id);
    }
  }

  // Check auth users for unknownAccessUsers
  const { data: uData } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const allUsersMap = new Map((uData?.users || []).map(u => [u.id, u]));

  console.log("Unknown access user ids count:", unknownAccessUsers.size);
  for (const id of unknownAccessUsers) {
    const u = allUsersMap.get(id);
    if (!u) {
      console.log("Access log user NOT in auth.users:", id);
    }
  }

  // Check audit_logs user_id
  const { data: auditLogs } = await sb.from('audit_logs').select('user_id, action, metadata').limit(2000);
  for (const al of auditLogs || []) {
    if (al.user_id && !allUsersMap.has(al.user_id)) {
      console.log("Audit log user NOT in auth.users:", al.user_id, al.action);
    }
  }
}
run();
