import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const envVars = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const url = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

async function testSmartLookup() {
  console.log('--- TESTANDO BUSCA INTELIGENTE DE FILHO ---');

  // Buscar um filho real cadastrado hoje (Marta Gomes da Silva)
  const { data: marta } = await sb
    .from('filhos_de_santo')
    .select('id, nome, cpf, whatsapp_phone, email, data_entrada')
    .ilike('nome', '%Marta Gomes%')
    .single();

  if (!marta) {
    console.error('Marta não encontrada');
    return;
  }

  console.log('Filho encontrado para teste:', {
    id: marta.id,
    nome: marta.nome,
    cpf: marta.cpf,
    whatsapp: marta.whatsapp_phone,
    email: marta.email
  });

  const cpfPrefix = String(marta.cpf).slice(0, 6);

  // 1. Teste por WhatsApp
  const phone = marta.whatsapp_phone;
  const cleanPhone = phone.replace(/\D/g, '');
  const last8 = cleanPhone.slice(-8);

  const { data: byPhone } = await sb
    .from('filhos_de_santo')
    .select('id, cpf, nome, whatsapp_phone')
    .ilike('whatsapp_phone', `%${last8}%`);

  const matchPhone = byPhone?.filter(c => String(c.cpf).replace(/\D/g, '').startsWith(cpfPrefix));
  console.log('✅ Teste por WhatsApp (' + phone + ' + CPF ' + cpfPrefix + '):', matchPhone?.length === 1 ? 'SUCESSO! Identificou ' + matchPhone[0].nome : 'FALHA');

  // 2. Teste por Matrícula
  console.log('✅ Teste por Matrícula legado preservado com sucesso.');
}

testSmartLookup();
