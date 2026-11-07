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

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || 'https://vlaojhfwhqmwudqsumpi.supabase.co';
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('==================================================');
  console.log('🧪 SUÍTE DE TESTES DE AUTENTICAÇÃO REAL (PRODUÇÃO)');
  console.log('==================================================\n');

  console.log('Aguardando 20 segundos para reset da janela de rate-limit...');
  await sleep(22000);

  let passed = 0;
  let total = 0;

  // Teste 1: Filho de Santo via WhatsApp
  total++;
  try {
    const res = await fetch('https://axecloud.com.br/api/auth/filho-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: '21972878566', cpfPrefix: '003602' }),
    });
    const data = await res.json();
    if (res.status === 200 && data.access_token && data.token_type === 'bearer') {
      console.log('✅ [TESTE 1/5] Filho de Santo via WhatsApp (21972878566 + CPF 003602): SUCESSO');
      console.log('   -> Token emitido com expiração de', data.expires_in, 's');
      passed++;
    } else {
      console.error('❌ [TESTE 1/5] Falhou:', res.status, data);
    }
  } catch (err) {
    console.error('❌ [TESTE 1/5] Erro de rede:', err.message);
  }

  // Teste 2: Filho de Santo via Matrícula AXC
  total++;
  try {
    const res = await fetch('https://axecloud.com.br/api/auth/filho-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: 'AXC-2026-5C8A', cpfPrefix: '003602' }),
    });
    const data = await res.json();
    if (res.status === 200 && data.access_token && data.token_type === 'bearer') {
      console.log('✅ [TESTE 2/5] Filho de Santo via Matrícula (AXC-2026-5C8A + CPF 003602): SUCESSO');
      console.log('   -> Token emitido com sucesso');
      passed++;
    } else {
      console.error('❌ [TESTE 2/5] Falhou:', res.status, data);
    }
  } catch (err) {
    console.error('❌ [TESTE 2/5] Erro de rede:', err.message);
  }

  // Teste 3: CPF Inválido deve ser recusado
  total++;
  try {
    const res = await fetch('https://axecloud.com.br/api/auth/filho-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: '21972878566', cpfPrefix: '111111' }),
    });
    const data = await res.json();
    if (res.status === 401 && (data.error || data.code === 'INVALID_CREDENTIALS')) {
      console.log('✅ [TESTE 3/5] Proteção de Senha: CPF incorreto rejeitado corretamente (401)');
      passed++;
    } else {
      console.error('❌ [TESTE 3/5] Falhou ao rejeitar:', res.status, data);
    }
  } catch (err) {
    console.error('❌ [TESTE 3/5] Erro:', err.message);
  }

  // Teste 4: Identificador inexistente deve ser recusado
  total++;
  try {
    const res = await fetch('https://axecloud.com.br/api/auth/filho-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId: '99999999999', cpfPrefix: '000000' }),
    });
    const data = await res.json();
    if (res.status === 401) {
      console.log('✅ [TESTE 4/5] Proteção de Identificador: Usuário inexistente rejeitado corretamente (401)');
      passed++;
    } else {
      console.error('❌ [TESTE 4/5] Falhou:', res.status, data);
    }
  } catch (err) {
    console.error('❌ [TESTE 4/5] Erro:', err.message);
  }

  // Teste 5: Autenticação de Zelador (Supabase Auth Client)
  total++;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.auth.signInWithPassword({
      email: 'teste_invalido_seguro@axecloud.com.br',
      password: 'senha_incorreta_proposital',
    });
    if (error && error.message.includes('Invalid login credentials')) {
      console.log('✅ [TESTE 5/5] Supabase Auth Zelador: Fluxo ativo e validando credenciais corretamente (Invalid login credentials)');
      passed++;
    } else {
      console.error('❌ [TESTE 5/5] Resposta inesperada:', { data, error });
    }
  } catch (err) {
    console.error('❌ [TESTE 5/5] Erro:', err.message);
  }

  console.log('\n==================================================');
  console.log(`🎯 RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO!`);
  console.log('==================================================');
}

runTestSuite();
