import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const userId = 'ab2eef13-604c-4c8f-9d14-f3da41cc5a81';

// Test what tenantInfoRoute queries:
const childRes = await sb
  .from("filhos_de_santo")
  .select("id, nome, tenant_id, lider_id, cargo")
  .eq("user_id", userId)
  .maybeSingle();

console.log("childRes:", childRes);

const PILOT_TEST_TENANT_ID = "fad75b91-d2eb-4805-b5a3-c19e8a073bed";
const { data: coAdmin } = await sb
  .from("piloto_coadministradores")
  .select("ativo, cargo_delegado")
  .eq("tenant_id", PILOT_TEST_TENANT_ID)
  .eq("filho_id", childRes.data.id)
  .eq("ativo", true)
  .maybeSingle();

console.log("coAdmin:", coAdmin);

// Now let's fetch what production https://axecloud.com.br/api/tenant-info returns!
const prodRes = await fetch(`https://axecloud.com.br/api/tenant-info?userId=${userId}`);
console.log("Production API response status:", prodRes.status);
const prodData = await prodRes.json();
console.log("Production API response data:", prodData);
