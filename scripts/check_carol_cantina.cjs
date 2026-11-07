const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function checkCarolActivity() {
  const tenantId = 'd6bd4829-a1a8-4d33-bc4d-e929455735b1';
  console.log('--- VERIFICANDO ATIVIDADE DE CAROL (tenant:', tenantId, ') ---');

  // 1. Financeiro (todas as transações do tenant)
  const { data: fin, error: finErr } = await supabase
    .from('financeiro')
    .select('*')
    .eq('tenant_id', tenantId);
  console.log('Financeiro rows total:', fin ? fin.length : finErr);
  if (fin && fin.length > 0) {
    console.log('Financeiro records:', JSON.stringify(fin, null, 2));
  }

  // 2. Transações de Cantina especificamente
  const cantinaRows = fin ? fin.filter(f => f.categoria === 'Cantina' || f.cantina_itens || f.cantina_comanda_id) : [];
  console.log('Transações de Cantina:', cantinaRows.length);

  // 3. Verificar se há itens de cardápio salvos no banco ou configurações
  // Vamos ver se existe tabela de cardapio ou se é em configuracoes / tenant metadata
  const { data: config } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('tenant_id', tenantId);
  console.log('Configurações:', config);

  // 4. Filhos cadastrados por Carol
  const { data: filhos } = await supabase
    .from('filhos_de_santo')
    .select('id, nome, cargo, telefone, limite_lojinha, bloquear_fiado_loja, created_at')
    .eq('tenant_id', tenantId);
  console.log('Filhos cadastrados:', filhos);
}

checkCarolActivity();
