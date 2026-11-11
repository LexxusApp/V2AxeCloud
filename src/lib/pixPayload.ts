export interface PixConfig {
  chave_pix: string;
  tipo_chave?: string;
  nome_beneficiario: string;
  cidade?: string;
}

const ascii = (text: string) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').trim();
const emailPattern = /^[a-z0-9.!#$'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const phonePattern = /^\+[1-9]\d{1,14}$/;
const evpPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function inferKeyType(key: string): string {
  if (key.includes('@')) return 'email';
  if (key.startsWith('+') || key.startsWith('(')) return 'telefone';
  if (evpPattern.test(key.toLowerCase())) return 'aleatoria';
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(key)) return 'cpf';
  if (/^[a-zA-Z0-9]{12}\d{2}$/.test(key) || key.includes('/')) return 'cnpj';
  return '';
}

export function normalizePixKey(value: string, configuredType?: string): string {
  const input = String(value || '').trim();
  const type = ascii(configuredType || '').toLowerCase() || inferKeyType(input);
  const formatted = input.replace(/[. /-]/g, '');
  switch (type) {
    case 'cpf':
      if (/^\d{11}$/.test(formatted)) return formatted;
      break;
    case 'cnpj':
      if (/^[a-zA-Z0-9]{12}\d{2}$/.test(formatted)) return formatted.toUpperCase();
      break;
    case 'celular':
    case 'telefone':
    case 'phone': {
      const compact = input.replace(/[ ().-]/g, '');
      if (phonePattern.test(compact)) return compact;
      if (/^\d{10,11}$/.test(compact)) return '+55' + compact;
      if (/^55\d{10,11}$/.test(compact)) return '+' + compact;
      break;
    }
    case 'email':
    case 'e-mail': {
      const email = input.toLowerCase();
      if (email.length <= 77 && emailPattern.test(email)) return email;
      break;
    }
    case 'aleatoria':
    case 'random':
    case 'evp': {
      const evp = input.toLowerCase();
      if (evpPattern.test(evp)) return evp;
      break;
    }
  }
  throw Error('Confira a chave Pix cadastrada e o tipo selecionado.');
}

const field = (id: string, value: string) => {
  if (value.length > 99) throw Error('Campo Pix excedeu o tamanho permitido.');
  return id + String(value.length).padStart(2, '0') + value;
};

export function pixCrc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/** Static BR Code, BCB Manual de Padrões para Iniciação do Pix, §2.6. */
export function buildStaticPixPayload(config: PixConfig, value: number | undefined, txid: string, description: string): string {
  const key = normalizePixKey(config.chave_pix, config.tipo_chave);
  const name = ascii(config.nome_beneficiario).toUpperCase().slice(0, 25);
  const configuredCity = ascii(config.cidade || '').toUpperCase();
  const city = !configuredCity || configuredCity === 'BRASIL' ? 'SAO PAULO' : configuredCity.slice(0, 15);
  const amount = value?.toFixed(2);

  if (!name) throw Error('Informe o beneficiário para gerar o Pix.');
  if (value !== undefined && (!Number.isFinite(value) || value > 999999999.99 || Number(amount) <= 0)) {
    throw Error('Informe um valor válido para gerar o Pix.');
  }
  const reference = String(txid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const accountKey = field('00', 'br.gov.bcb.pix') + field('01', key);
  const info = ascii(description).slice(0, Math.max(0, Math.min(20, 99 - accountKey.length - 4)));
  const account = accountKey + (info ? field('02', info) : '');

  const payload = field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986')
    + (amount === undefined ? '' : field('54', amount)) + field('58', 'BR') + field('59', name) + field('60', city)
    + field('62', field('05', reference)) + '6304';
  return payload + pixCrc16(payload);
}

export function buildPixPayload(config: PixConfig, value: number, txid: string, description: string): string {
  return buildStaticPixPayload(config, value, txid, description);
}
