import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

const { data: profiles } = await sb
  .from("perfil_lider")
  .select("id, nome_terreiro, email")
  .order("nome_terreiro", { ascending: true })
  .limit(10);

console.log("Profiles in database:", profiles);
