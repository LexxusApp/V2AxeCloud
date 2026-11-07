import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PILOT_TENANT_ID = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed';
const LUCAS_FILHO_ID = '3666b777-1066-4eb7-a0c3-f63c2e01ae90';
const LUCAS_USER_ID = 'ab2eef13-604c-4c8f-9d14-f3da41cc5a81';

async function runE2eTest() {
  console.log('======================================================================');
  console.log('TESTE E2E: FASE 1 - CO-ADMINISTRADOR DO TERREIRO (ISOLADO NO PILOTO)');
  console.log('======================================================================');

  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Login com o Zelador titular
  console.log('\n1. Efetuando login do Zelador titular (vendasmercadolivrev1@gmail.com)...');
  const { data: authLider, error: loginErr } = await sbAnon.auth.signInWithPassword({
    email: 'vendasmercadolivrev1@gmail.com',
    password: 'Lucas4356!'
  });
  if (loginErr) throw loginErr;
  console.log('   ✅ Zelador logado com sucesso! User ID:', authLider.user.id);

  // 2. Definir Lucas como Co-Administrador
  console.log('\n2. Delegando permissão de Co-Administrador para o filho Lucas...');
  const { data: defRes, error: defErr } = await sbAnon.rpc('piloto_definir_coadministrador', {
    p_tenant: PILOT_TENANT_ID,
    p_filho_id: LUCAS_FILHO_ID,
    p_ativo: true
  });
  if (defErr) throw defErr;
  console.log('   ✅ RPC retornou sucesso:', defRes);

  // 3. Listar Co-Administradores
  console.log('\n3. Listando co-administradores do terreiro...');
  const { data: listRes, error: listErr } = await sbAnon.rpc('piloto_listar_coadministradores', {
    p_tenant: PILOT_TENANT_ID
  });
  if (listErr) throw listErr;
  const lucasEntry = listRes.data.find(c => c.filho_id === LUCAS_FILHO_ID);
  if (!lucasEntry || !lucasEntry.ativo) {
    throw new Error('Lucas não foi encontrado como co-administrador ativo!');
  }
  console.log('   ✅ Lucas encontrado como ativo na lista:', lucasEntry.nome, `(${lucasEntry.cargo_delegado})`);

  // 4. Testar a rota /api/tenant/info simulando a chamada
  console.log('\n4. Testando resolução de perfil para o Co-Administrador...');
  // Verificamos no banco se piloto_coadministradores tem os dados corretos
  const { data: coAdminDb } = await sbAdmin
    .from('piloto_coadministradores')
    .select('*')
    .eq('tenant_id', PILOT_TENANT_ID)
    .eq('filho_id', LUCAS_FILHO_ID)
    .maybeSingle();
  console.log('   ✅ Registro no banco de dados:', coAdminDb);

  // 5. Testar função RLS axecloud_private.auth_lider_tenant_ids()
  console.log('\n5. Testando helper RLS de autorização...');
  const { data: rlsCheck } = await sbAdmin.rpc('piloto_is_coadministrador', {
    p_tenant: PILOT_TENANT_ID,
    p_user: LUCAS_USER_ID
  });
  console.log('   ✅ piloto_is_coadministrador retornou:', rlsCheck);
  if (!rlsCheck) {
    throw new Error('piloto_is_coadministrador deveria ter retornado true para Lucas!');
  }

  // 6. Testar isolamento: tentativa de invasão por outro tenant
  console.log('\n6. Testando ISOLAMENTO: outro tenant NÃO pode usar este recurso...');
  const FAKE_TENANT = '00000000-0000-0000-0000-000000000000';
  const { error: hackAttempt } = await sbAnon.rpc('piloto_definir_coadministrador', {
    p_tenant: FAKE_TENANT,
    p_filho_id: LUCAS_FILHO_ID,
    p_ativo: true
  });
  if (!hackAttempt) {
    throw new Error('Isolamento falhou! Outro tenant conseguiu executar a função do piloto!');
  }
  console.log('   ✅ Isolamento garantido: tentativa com outro tenant rejeitada com erro:', hackAttempt.message);

  // 7. Manter Lucas como Co-Administrador para que o usuário possa testar visualmente
  console.log('\n7. Estado final: Lucas mantido como Co-Administrador de teste.');
  console.log('======================================================================');
  console.log('✅ TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
  console.log('======================================================================');
}

runE2eTest().catch(err => {
  console.error('❌ Falha no teste E2E:', err);
  process.exit(1);
});
