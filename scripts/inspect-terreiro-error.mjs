import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = value;
  }
});

const ref = env.SUPABASE_PROJECT_REF;
const token = env.SUPABASE_ACCESS_TOKEN;

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  return await res.json();
}

async function main() {
  console.log('--- 1. Check Tenda de Umbanda Casa de Oxóssi Caridade e Amor (5de04732-9419-4ef5-8558-7287ed140e79) ---');
  const perfil1 = await query(`select * from public.perfil_lider where id = '5de04732-9419-4ef5-8558-7287ed140e79' or tenant_id = '5de04732-9419-4ef5-8558-7287ed140e79'`);
  console.log('perfil_lider 1:', perfil1);
  const pix1 = await query(`select * from public.configuracoes_pix where terreiro_id = '5de04732-9419-4ef5-8558-7287ed140e79'`);
  console.log('configuracoes_pix 1:', pix1);
  const sub1 = await query(`select * from public.subscriptions where id = '5de04732-9419-4ef5-8558-7287ed140e79'`);
  console.log('subscription 1:', sub1);

  console.log('\n--- 2. Check Ọjú Ọ̀sányìn Birigã Àṣẹ Agodô (771c88ba-c51d-40ff-bd8f-dd2b9b343a74) ---');
  const perfil2 = await query(`select * from public.perfil_lider where id = '771c88ba-c51d-40ff-bd8f-dd2b9b343a74' or tenant_id = '771c88ba-c51d-40ff-bd8f-dd2b9b343a74'`);
  console.log('perfil_lider 2:', perfil2);
  const pix2 = await query(`select * from public.configuracoes_pix where terreiro_id = '771c88ba-c51d-40ff-bd8f-dd2b9b343a74'`);
  console.log('configuracoes_pix 2:', pix2);

  console.log('\n--- 3. Check Filho 00cb5674-1bf5-4f9c-b0da-d3d535d66dbd ---');
  const filho = await query(`select * from public.filhos_de_santo where id = '00cb5674-1bf5-4f9c-b0da-d3d535d66dbd' or user_id = '00cb5674-1bf5-4f9c-b0da-d3d535d66dbd'`);
  console.log('filho:', filho);

  console.log('\n--- 4. All failures in tenant_feature_failures for these tenants today ---');
  const fails = await query(`
    select id, created_at, tenant_id, feature, route, http_status, error_message, metadata
    from public.tenant_feature_failures
    where tenant_id in ('5de04732-9419-4ef5-8558-7287ed140e79', '771c88ba-c51d-40ff-bd8f-dd2b9b343a74')
       or metadata::text like '%5de04732%' or metadata::text like '%771c88ba%' or metadata::text like '%00cb5674%'
    order by created_at desc
  `);
  console.log('Failures detail count:', fails.length);
  fails.forEach(f => {
    console.log(`[${f.created_at}] Route: ${f.route} | Status: ${f.http_status} | Error: ${f.error_message}`);
    console.log('Metadata:', JSON.stringify(f.metadata));
  });
}

main().catch(console.error);
