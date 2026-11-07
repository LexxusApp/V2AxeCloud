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
  const { data: msgs } = await sb.from("admin_whatsapp_messages")
    .select("created_at, direction, body")
    .eq("conversation_id", "a49e90dd-a501-459f-acee-2874e36e7a67")
    .order("created_at", { ascending: true });
  for (const m of msgs || []) {
    console.log(`[${m.created_at}] (${m.direction}): ${m.body}`);
  }
}
run();
