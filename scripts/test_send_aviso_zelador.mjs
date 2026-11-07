import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.trim().startsWith('#')) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}

const token = env.WA_META_TOKEN || env.META_WHATSAPP_ACCESS_TOKEN;
const phoneId = env.WA_PHONE_NUMBER_ID || env.META_WHATSAPP_PHONE_NUMBER_ID;

const payload = {
  messaging_product: 'whatsapp',
  to: '5511920033501',
  type: 'template',
  template: {
    name: 'aviso_acesso_filhos_zelador_axc',
    language: { code: 'pt_BR' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Lucas' },
          { type: 'text', text: 'AxéCloud Sede' }
        ]
      }
    ]
  }
};

async function send() {
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', JSON.stringify(data, null, 2));
}

send();
