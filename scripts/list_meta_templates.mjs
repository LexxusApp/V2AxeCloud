import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^["']|["']$/g, '');
    env[match[1]] = value;
  }
});

const token = env.WA_META_TOKEN;
const waba = env.WA_BUSINESS_ACCOUNT_ID;

async function run() {
  const res = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates?limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.data) {
    console.log(`Found ${data.data.length} templates:`);
    for (const t of data.data) {
      console.log(`- ${t.name} | Status: ${t.status} | Category: ${t.category}`);
      if (t.name.includes('membro') || t.name.includes('acesso') || t.name.includes('conta')) {
        console.log(`  Components:`, JSON.stringify(t.components));
      }
    }
  } else {
    console.error('Error fetching templates:', data);
  }
}

run().catch(console.error);
