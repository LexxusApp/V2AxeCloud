const ascii = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').trim();
const field = (id, value) => {
  if (value.length > 99) throw Error('Campo Pix excedeu o tamanho permitido.');
  return id + String(value.length).padStart(2, '0') + value;
};
export function pixCrc16(text) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload(config, value, txid, description) {
  let key = String(config.chave_pix || '').trim();
  const type = String(config.tipo_chave || '').toLowerCase();
  if (type === 'cpf' || type === 'cnpj') key = key.replace(/\D/g, '');
  if (type === 'celular' || type === 'phone') {
    const digits = key.replace(/\D/g, '');
    key = '+' + (digits.length === 10 || digits.length === 11 ? '55' + digits : digits);
  }
  if (!key || key.length > 77 || /[^\x21-\x7e]/.test(key)) throw Error('Confira a chave Pix cadastrada.');
  if ((type === 'cpf' && !/^\d{11}$/.test(key)) || (type === 'cnpj' && !/^\d{14}$/.test(key))
    || ((type === 'celular' || type === 'phone') && !/^\+\d{10,15}$/.test(key))
    || (type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key))) throw Error('Confira o formato da chave Pix cadastrada.');
  const name = ascii(config.nome_beneficiario).toUpperCase().slice(0, 25);
  const city = ascii(config.cidade || 'BRASIL').toUpperCase().slice(0, 15);
  if (!name || !city || !Number.isFinite(value) || value <= 0 || value > 999999999.99) throw Error('Informe beneficiário e valor válidos para gerar o Pix.');
  const reference = String(txid || '').trim() === '***' ? '***' : String(txid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const info = ascii(description).slice(0, Math.max(0, Math.min(20, 99 - 18 - 4 - key.length - 4)));
  const account = field('00', 'br.gov.bcb.pix') + field('01', key) + (info ? field('02', info) : '');
  const payload = field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986')
    + field('54', value.toFixed(2)) + field('58', 'BR') + field('59', name) + field('60', city)
    + field('62', field('05', reference)) + '6304';
  return payload + pixCrc16(payload);
}

const config = {
  chave_pix: 'fernandodosogiyan@gmail.com',
  tipo_chave: 'email',
  nome_beneficiario: 'Luiz Fernando de Oliveira Carnaval',
  cidade: undefined
};

const payload = buildPixPayload(config, 100, '***', 'Mensalidade terreiro');
console.log('Payload:', payload);
console.log('Length:', payload.length);
