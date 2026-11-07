import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

// Get an admin JWT token by signing in as lucasilvasiqueira@outlook.com.br
// Or let's see how tokens are generated for admin
console.log("Checking production API output...");

const res = await fetch("https://admin.axecloud.com.br/api/admin-console/mensalidades/tenants", {
  headers: {
    // we don't have user's browser token, but let's see if it returns 401
  }
});
console.log("Status:", res.status);
const text = await res.text();
console.log("Response:", text.slice(0, 300));
