import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCantina() {
  const { data, error } = await supabase
    .from('filhos_de_santo')
    .select('id, nome, limite_lojinha, bloquear_fiado_loja')
    .limit(2);

  console.log('Result for filhos_de_santo cantina columns:');
  console.log('Error:', error ? error.message : null);
  console.log('Sample data:', data);

  const { data: finData, error: finError } = await supabase
    .from('financeiro')
    .select('id, categoria, status, valor')
    .eq('categoria', 'Cantina')
    .limit(3);

  console.log('\nResult for financeiro Cantina:');
  console.log('Error:', finError ? finError.message : null);
  console.log('Sample data count:', finData ? finData.length : 0);
  console.log('Sample transactions:', finData);
}

testCantina().catch(console.error);
