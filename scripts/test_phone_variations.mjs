import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.trim().startsWith('#')) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

// Pick a real child from DB
async function test() {
  const { data: children } = await sb.from('filhos_de_santo')
    .select('id, nome, cpf, whatsapp_phone')
    .not('whatsapp_phone', 'is', null)
    .not('cpf', 'is', null)
    .limit(3);

  for (const c of children || []) {
    const phone = c.whatsapp_phone; // e.g. "11994583999"
    const cpf6 = c.cpf.replace(/\D/g, '').slice(0, 6);
    console.log(`\nTestando filho: ${c.nome} (DB: ${phone}, CPF6: ${cpf6})`);

    const variations = [
      phone, // "11994583999"
      `0${phone}`, // "011994583999"
      `55${phone}`, // "5511994583999"
      `+55 ${phone.slice(0, 2)} ${phone.slice(2)}`, // "+55 11 994583999"
      `+55 0${phone.slice(0, 2)} ${phone.slice(2)}`, // "+55 011 994583999"
      `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`, // "(11) 99458-3999"
      `(0${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`, // "(011) 99458-3999"
    ];

    for (const v of variations) {
      // 1. Worker logic
      const cleanPhone = v.replace(/\D/g, "");
      const national = cleanPhone.replace(/^55/, "");
      const last8 = national.slice(-8);
      const qs = `ilike.%${last8}%`;

      const { data: workerMatches } = await sb.from('filhos_de_santo')
        .select('id, nome, cpf, whatsapp_phone')
        .ilike('whatsapp_phone', `%${last8}%`);

      const workerMatched = (workerMatches || []).find(r => 
        String(r.cpf || '').replace(/\D/g, '').startsWith(cpf6)
      );

      // 2. Container route logic
      const cleanDigits = v.replace(/\D/g, "");
      const passesRouteLen = cleanDigits.length >= 10 && cleanDigits.length <= 13 && !v.toUpperCase().startsWith("AXC-");
      
      console.log(`  Input: "${v}" (digits: ${cleanDigits}, len: ${cleanDigits.length}) -> Worker matched: ${workerMatched?.id === c.id ? 'OK' : 'FAIL'} | Route len check: ${passesRouteLen ? 'OK' : 'BLOCKED'}`);
    }
  }
}

test();
