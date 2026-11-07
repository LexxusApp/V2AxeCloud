import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const map = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
});

const url = map['VITE_SUPABASE_URL'];
const key = map['SUPABASE_SERVICE_ROLE_KEY'];

async function testCreateUser() {
  console.log('Testando criação de usuário de teste via Supabase Auth Admin REST...');
  const testEmail = `teste.zelador.${Date.now()}@axecloud.test`;
  const testPassword = `Axe@${Math.floor(1000 + Math.random() * 9000)}`;
  const nomeZelador = 'Pai Carlos de Ogum';
  const nomeTerreiro = 'Ilê Axé Omo Ogum';
  const whatsapp = '+5511999998888';

  // 1. Criar usuário no Supabase Auth
  const authRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        nome_terreiro: nomeTerreiro,
        nome_zelador: nomeZelador,
        whatsapp,
        plan: 'premium',
      },
    }),
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    throw new Error(`Falha ao criar usuário (${authRes.status}): ${errText}`);
  }

  const authUser = await authRes.json();
  const userId = authUser.id || authUser.user?.id;
  console.log('Usuário Auth criado com sucesso! ID:', userId);

  // 2. Criar Subscription com 30 dias de teste
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const subRes = await fetch(`${url}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: userId,
      plan: 'premium',
      status: 'active',
      expires_at: expiresAt,
    }),
  });
  console.log('Subscription criada:', subRes.status);

  // 3. Criar Perfil Líder
  const profRes = await fetch(`${url}/rest/v1/perfil_lider`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: userId,
      email: testEmail,
      nome_terreiro: nomeTerreiro,
      cargo: nomeZelador,
      role: 'admin',
      tenant_id: userId,
      whatsapp_publico: whatsapp.replace(/\D/g, '').slice(0, 15),
      updated_at: new Date().toISOString(),
    }),
  });
  console.log('Perfil Líder criado:', profRes.status);

  // Limpeza do teste
  const delRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log('Limpeza do usuário de teste concluída:', delRes.status);
}

testCreateUser().catch(console.error);
