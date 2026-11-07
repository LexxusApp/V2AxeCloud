import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const emails = [
    'matheusaguiar.s1997@gmail.com',
    'romariojesusdecastro@gmail.com',
    'centrinylegydokan@gmail.com',
    'flaviasante@hotmail.com',
    'gracinhadecabofrio@gmail.com',
    'rebecafernandareh@gmail.com',
    'elidatelles@yahoo.com.br'
  ];

  for (const email of emails) {
    const { data: user } = await sb.from('perfil_lider').select('id, nome_terreiro, email, created_at').eq('email', email).maybeSingle();
    if (!user) continue;
    const authUser = await sb.auth.admin.getUserById(user.id);
    const phone = authUser.data?.user?.user_metadata?.whatsapp;
    const { data: logs } = await sb.from('whatsapp_logs').select('tipo, status, created_at, mensagem').eq('tenant_id', user.id).order('created_at', { ascending: false });
    console.log(`\n=== ${user.nome_terreiro} (${email}) | Tel: ${phone} ===`);
    console.log(`Criado em: ${user.created_at}`);
    console.log(`WhatsApp logs (${logs?.length || 0}):`);
    logs?.forEach(l => console.log(`  - [${l.created_at}] ${l.tipo} -> ${l.status}`));
  }
}

main().catch(console.error);
