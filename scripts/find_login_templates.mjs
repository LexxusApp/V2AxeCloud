import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^["']|["']$/g, '');
});

async function run() {
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WA_BUSINESS_ACCOUNT_ID}/message_templates?limit=100`, {
    headers: { Authorization: `Bearer ${env.WA_META_TOKEN}` }
  });
  const d = await res.json();
  for (const t of d.data || []) {
    const text = JSON.stringify(t.components);
    if (text.toLowerCase().includes('login') || text.toLowerCase().includes('opç') || text.toLowerCase().includes('modo=filho') || text.toLowerCase().includes('registro')) {
      console.log('\n========================================');
      console.log('Template:', t.name, '| Status:', t.status, '| Category:', t.category);
      for (const c of t.components || []) {
        if (c.text) console.log(`[${c.type}]`, c.text);
        if (c.buttons) console.log(`[BUTTONS]`, JSON.stringify(c.buttons));
      }
    }
  }
}

run().catch(console.error);
