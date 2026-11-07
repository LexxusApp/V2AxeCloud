import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vlaojhfwhqmwudqsumpi.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYW9qaGZ3aHFtd3Vkc3VtcGkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNjE5ODE1MSwiZXhwIjoyMDUxNzc0MTUxfQ.gEAGQpW6h19k-o5u7-Msq6_dYdJ322n8yQ7-aB8R6xU';

async function main() {
  const res = await fetch('https://axecloud.com.br/api/public-config');
  const cfg = await res.json();
  console.log('Public config:', cfg);

  // We need Lucas's token or we can call Supabase direct to see if piloto_is_coadministrador works
  const supabase = createClient(cfg.supabaseUrl || SUPABASE_URL, cfg.supabaseAnonKey || SUPABASE_ANON);
  const { data: coAdmins, error } = await supabase
    .from('piloto_coadministradores')
    .select('*');
  console.log('Direct coAdmins query (anon):', coAdmins, 'error:', error);

  // Check RPC piloto_is_coadministrador
  const { data: isCoAdmin, error: rpcErr } = await supabase.rpc('piloto_is_coadministrador', {
    p_tenant: 'fad75b91-d2eb-4805-b5a3-c19e8a073bed',
    p_user: 'ab2eef13-604c-4c8f-9d14-f3da41cc5a81'
  });
  console.log('RPC isCoAdmin (anon):', isCoAdmin, 'error:', rpcErr);
}

main().catch(console.error);
