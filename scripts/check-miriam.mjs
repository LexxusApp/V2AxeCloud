import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);

const sb = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: miriam } = await sb
  .from('perfil_lider')
  .select('*')
  .eq('id', 'a90db681-e55f-4668-8715-34e23ffbb591')
  .maybeSingle();

console.log('Miriam perfil_lider:', miriam);

// Auth user
const { data: { users } } = await sb.auth.admin.listUsers();
const miriamAuth = users.find(u => u.id === 'a90db681-e55f-4668-8715-34e23ffbb591');
console.log('Miriam auth user:', miriamAuth ? { id: miriamAuth.id, email: miriamAuth.email } : 'NOT FOUND');
