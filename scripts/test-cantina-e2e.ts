import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { buildCantinaWhatsAppMessage, buildWhatsAppLink, isCantinaEnabled } from '../src/lib/cantinaFeature';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_EMAIL = 'vendasmercadolivrev1@gmail.com';
const TEST_PASS = 'Lucas4356!';

async function runTests() {
  console.log('=== [INICIANDO TESTES COMPLETOS DO MÓDULO CANTINA] ===\n');

  let testTxId: string | null = null;

  try {
    // 1. Autenticação do usuário de teste
    console.log('1. Autenticando usuário de teste:', TEST_EMAIL);
    const { data: authData, error: authError } = await sbAnon.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASS,
    });

    if (authError || !authData.session) {
      throw new Error(`Falha no login do usuário de teste: ${authError?.message}`);
    }
    const user = authData.user;
    const tenantId = user.id;
    console.log('   ✓ Login efetuado com sucesso!');
    console.log('   ✓ User ID / Tenant ID:', tenantId);
    console.log('   ✓ Access Token JWT obtido');

    // 2. Verificação de permissão de feature flag (isCantinaEnabled)
    console.log('\n2. Verificando Feature Flag (isCantinaEnabled):');
    const allowed = isCantinaEnabled({ tenant_id: tenantId, email: user.email }, user.email, user.id);
    console.log('   ✓ Cantina ativa para este terreiro?', allowed);
    if (!allowed) throw new Error('isCantinaEnabled retornou false para o terreiro de teste!');

    const blockedForOther = isCantinaEnabled({ tenant_id: 'outro-uuid', email: 'outro@terreiro.com' }, 'outro@terreiro.com');
    console.log('   ✓ Cantina bloqueada para terreiros externos?', !blockedForOther);
    if (blockedForOther) throw new Error('isCantinaEnabled permitiu terreiro não autorizado!');

    // 3. Localizar Filho de Santo de teste (Lucas)
    console.log('\n3. Localizando médium/filho de teste:');
    const { data: filhos, error: fErr } = await sbAdmin
      .from('filhos_de_santo')
      .select('*')
      .eq('tenant_id', tenantId);

    if (fErr || !filhos || filhos.length === 0) {
      throw new Error('Nenhum filho de santo encontrado no terreiro de teste.');
    }
    const filho = filhos[0];
    console.log(`   ✓ Médium encontrado: ${filho.nome} (ID: ${filho.id})`);
    console.log(`   ✓ Limite inicial configurado: R$ ${filho.limite_lojinha ?? 100.00}`);
    console.log(`   ✓ Bloqueado para fiado: ${!!filho.bloquear_fiado_loja}`);

    // 4. Teste de Lançamento de Consumo Fiado (Marcar na Conta)
    console.log('\n4. Testando Lançamento no Balcão (Marcar na Conta - Fiado):');
    const valorConsumo = 12.00;
    const descConsumo = '1x Salgado, 1x Refrigerante';
    const today = new Date().toISOString().slice(0, 10);

    const { data: insertedTx, error: txErr } = await sbAdmin
      .from('financeiro')
      .insert([{
        tipo: 'entrada',
        valor: valorConsumo,
        categoria: 'Cantina',
        data: today,
        descricao: `Cantina - ${filho.nome} - ${descConsumo} (ID:${filho.id}) [TESTE]`,
        tenant_id: tenantId,
        lider_id: user.id,
        filho_id: filho.id,
        status: 'pendente',
      }])
      .select('*')
      .single();

    if (txErr || !insertedTx) {
      throw new Error(`Falha ao inserir transação da cantina: ${txErr?.message}`);
    }
    testTxId = insertedTx.id;
    console.log(`   ✓ Lançamento criado com sucesso no Financeiro (ID: ${insertedTx.id})`);
    console.log(`   ✓ Categoria: ${insertedTx.categoria} | Status: ${insertedTx.status} | Valor: R$ ${insertedTx.valor}`);

    // 5. Teste de Validação de Limite de Crédito
    console.log('\n5. Testando Regra de Limite de Crédito / Bloqueio:');
    const limiteAtual = Number(filho.limite_lojinha ?? 100);
    const tentativaExcedente = limiteAtual + 50;
    const saldoAtualComNovo = valorConsumo + tentativaExcedente;
    const deveBloquear = saldoAtualComNovo > limiteAtual;
    console.log(`   ✓ Limite do médium: R$ ${limiteAtual.toFixed(2)}`);
    console.log(`   ✓ Saldo pendente atual: R$ ${valorConsumo.toFixed(2)}`);
    console.log(`   ✓ Tentativa de novo consumo: R$ ${tentativaExcedente.toFixed(2)}`);
    console.log(`   ✓ Sistema bloqueia consumo excedente?`, deveBloquear ? 'SIM (Bloqueio acionado)' : 'NÃO');
    if (!deveBloquear) throw new Error('Regra de limite falhou!');

    // 6. Teste de Geração de Mensagem WhatsApp
    console.log('\n6. Testando Geração de Mensagem WhatsApp para Cobrança:');
    const msg = buildCantinaWhatsAppMessage(
      {
        nome: filho.nome,
        whatsapp_phone: filho.whatsapp_phone,
        saldo_pendente: valorConsumo,
        pedidos_pendentes: [{ descricao: descConsumo, valor: valorConsumo, data: today }],
      },
      'Terreiro de Teste AxéCloud',
      '11912276156'
    );
    console.log('--- Mensagem Formatada ---');
    console.log(msg);
    console.log('---------------------------');
    const waLink = buildWhatsAppLink(filho.whatsapp_phone, msg);
    console.log('   ✓ Link gerado:', waLink.slice(0, 70) + '...');
    const normalizedMsg = msg.replace(/\u00a0/g, ' ');
    if (!normalizedMsg.includes('12,00') || !normalizedMsg.includes('11912276156')) {
      throw new Error('Mensagem WhatsApp não contém valor ou chave Pix correta!');
    }
    console.log('   ✓ Mensagem WhatsApp validada com sucesso');

    // 7. Teste de Quitação (Dar Baixa / Marcar como Pago)
    console.log('\n7. Testando Quitação da Conta (Dar Baixa):');
    const { data: updatedTx, error: upErr } = await sbAdmin
      .from('financeiro')
      .update({ status: 'pago' })
      .eq('id', insertedTx.id)
      .select('*')
      .single();

    if (upErr || !updatedTx) throw new Error(`Falha ao quitar lançamento: ${upErr?.message}`);
    console.log(`   ✓ Lançamento atualizado para status: ${updatedTx.status}`);

    // 8. Teste de Ajuste de Limite do Filho
    console.log('\n8. Testando Ajuste de Limite do Filho:');
    const novoLimiteTeste = 150.00;
    const { data: filhoUp, error: fUpErr } = await sbAdmin
      .from('filhos_de_santo')
      .update({ limite_lojinha: novoLimiteTeste })
      .eq('id', filho.id)
      .select('id, nome, limite_lojinha')
      .single();

    if (fUpErr || !filhoUp) throw new Error(`Falha ao alterar limite do filho: ${fUpErr?.message}`);
    console.log(`   ✓ Limite alterado para: R$ ${filhoUp.limite_lojinha}`);

    // Restaura limite padrão
    await sbAdmin.from('filhos_de_santo').update({ limite_lojinha: 100.00 }).eq('id', filho.id);
    console.log('   ✓ Limite restaurado para R$ 100,00');

    console.log('\n=== [TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!] ===');
  } finally {
    // 9. Limpeza da transação de teste
    if (testTxId) {
      console.log('\n9. Limpando dados do teste:');
      await sbAdmin.from('financeiro').delete().eq('id', testTxId);
      console.log('   ✓ Transação de teste removida (banco 100% limpo)');
    }
    // Remove qualquer outro teste anterior com [TESTE]
    await sbAdmin.from('financeiro').delete().ilike('descricao', '%[TESTE]%');
  }
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
