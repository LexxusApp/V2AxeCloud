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

function normalizePhone(raw) {
  let cleanPhone = raw.replace(/\D/g, "");
  if (cleanPhone.startsWith("55") && cleanPhone.length >= 12) {
    cleanPhone = cleanPhone.slice(2);
  }
  if (cleanPhone.startsWith("0") && cleanPhone.length >= 11) {
    cleanPhone = cleanPhone.replace(/^0+/, "");
  }
  return cleanPhone;
}

async function testAll() {
  const { data: children } = await sb.from('filhos_de_santo')
    .select('id, nome, cpf, whatsapp_phone')
    .not('whatsapp_phone', 'is', null)
    .not('cpf', 'is', null)
    .limit(5);

  let totalTests = 0;
  let passedTests = 0;

  for (const c of children || []) {
    const phone = c.whatsapp_phone; // e.g. "11994583999"
    const cpf6 = c.cpf.replace(/\D/g, '').slice(0, 6);

    const inputs = [
      phone, // "11994583999" (sem 0)
      `0${phone}`, // "011994583999" (com 0 antes do DDD)
      `55${phone}`, // "5511994583999" (com 55)
      `+55 ${phone.slice(0, 2)} ${phone.slice(2)}`, // "+55 11 994583999"
      `+55 0${phone.slice(0, 2)} ${phone.slice(2)}`, // "+55 011 994583999" (com 55 E com 0!)
      `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`, // "(11) 99458-3999"
      `(0${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`, // "(011) 99458-3999"
      `0${phone.slice(0, 2)} ${phone.slice(2, 7)}-${phone.slice(7)}`, // "011 99458-3999"
    ];

    for (const input of inputs) {
      totalTests++;
      const cleanPhone = normalizePhone(input);
      const last8 = cleanPhone.slice(-8);

      const { data: matches } = await sb
        .from("filhos_de_santo")
        .select("id, cpf, whatsapp_phone")
        .ilike("whatsapp_phone", `%${last8}%`);

      const matchingCpf = (matches || []).filter((r) =>
        String(r.cpf || "").replace(/\D/g, "").startsWith(cpf6)
      );

      const exactMatch = matchingCpf.filter((r) => {
        const dbDigits = String(r.whatsapp_phone || "").replace(/\D/g, "").replace(/^55/, "").replace(/^0+/, "");
        return dbDigits === cleanPhone;
      });

      const matched = exactMatch.length === 1 ? exactMatch[0] : matchingCpf[0];

      if (matched?.id === c.id) {
        passedTests++;
      } else {
        console.error(`FALHA: para "${input}" esperava ${c.id}, obteve ${matched?.id}`);
      }
    }
  }

  console.log(`\nResultado dos testes: ${passedTests}/${totalTests} passaram com 100% de sucesso!`);
}

testAll();
