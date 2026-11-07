const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function searchCarol() {
  console.log('Searching for Carol across users / filhos / etc...');
  
  // 1. Check filhos_de_santo
  const { data: filhos } = await supabase
    .from('filhos_de_santo')
    .select('id, nome, tenant_id, lider_id, telefone, cargo')
    .ilike('nome', '%carol%');
  console.log('Filhos matching Carol:', filhos);

  // 2. Check auth.users via admin API
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (users?.users) {
    const carolUsers = users.users.filter(u => 
      (u.email && u.email.toLowerCase().includes('carol')) ||
      (u.user_metadata && JSON.stringify(u.user_metadata).toLowerCase().includes('carol'))
    );
    console.log('Auth users matching Carol:', carolUsers.map(u => ({
      id: u.id,
      email: u.email,
      metadata: u.user_metadata,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at
    })));
  }

  // 3. Search whatsapp_logs for Carol
  const { data: waLogs } = await supabase
    .from('whatsapp_logs')
    .select('id, telefone, tipo, mensagem, tenant_id, created_at')
    .ilike('mensagem', '%carol%')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('WhatsApp logs mentioning Carol:', waLogs);
}

searchCarol();
