import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envConfig = dotenv.parse(fs.readFileSync('./.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testAutoReply() {
  const { handleGrowthInboundAutoReply } = await import('../api/lib/growthSalesAgent.js');
  console.log('Testing handleGrowthInboundAutoReply for 555384591717...');
  const res = await handleGrowthInboundAutoReply(sb, {
    phone: '555384591717',
    inboundBody: 'Após os 30 dias qual o valor mensal ?',
    inboundAt: '2026-10-20T14:16:14.309Z'
  });
  console.log('Result:', res);
}

testAutoReply().catch(console.error);
