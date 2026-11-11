import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPixPayload, normalizePixKey, pixCrc16 } from '../src/lib/pixPayload.ts';
import { buildPixPayload as buildApiPixPayload } from '../api/lib/pixPayload.ts';
const config = { chave_pix: 'casa@example.invalid', tipo_chave: 'email', nome_beneficiario: 'Ilê Axé São João', cidade: 'São Paulo' };
function fields(payload: string) {
  const result: Record<string, string> = {};
  for (let index = 0; index < payload.length;) {
    const length = Number(payload.slice(index + 2, index + 4));
    assert.ok(Number.isInteger(length));
    const value = payload.slice(index + 4, index + 4 + length);
    assert.equal(value.length, length);
    result[payload.slice(index, index + 2)] = value;
    index += 4 + length;
    assert.ok(index <= payload.length);
  }
  return result;
}
test('CRC-16/CCITT-FALSE corresponde ao vetor padrão e protege o BR Code', () => {
  assert.equal(pixCrc16('123456789'), '29B1');
  // Banco Central, Manual de Padrões para Iniciação do Pix, seção 2.6.3.
  const official = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(pixCrc16(official), '1D3D');
  const code = buildPixPayload(config, 102, 'MensalidadeAbc123', 'Contribuição de setembro');
  assert.equal(code.slice(-4), pixCrc16(code.slice(0, -4)));
  const top = fields(code), account = fields(top['26']);
  assert.equal(top['54'], '102.00');
  assert.equal(top['59'], 'ILE AXE SAO JOAO');
  assert.equal(top['60'], 'SAO PAULO');
  assert.equal(account['01'], config.chave_pix);
  assert.equal(fields(top['62'])['05'], 'MensalidadeAbc123');
  assert.equal(top['01'], undefined); // no single-use flag on reusable static key QR
});
test('terminal sem identificador preserva *** e não inventa um identificador igual para todos', () => {
  assert.equal(fields(fields(buildPixPayload(config, 3.5, '***', ''))['62'])['05'], '***');
  assert.equal(fields(fields(buildPixPayload(config, 3.5, '', ''))['62'])['05'], '***');
});
test('CPF/CNPJ e telefone formatados são serializados no formato da chave', () => {
  for (const [type, input, expected] of [['cpf','123.456.789-09','12345678909'],['cnpj','12.345.678/0001-90','12345678000190'],['celular','(11) 91234-5678','+5511912345678']]) {
    const payload = buildPixPayload({ ...config, tipo_chave: type, chave_pix: input }, 1, 'A1', '');
    assert.equal(fields(fields(payload)['26'])['01'], expected);
  }
});
test('normaliza as chaves cadastradas nos dois painéis e mantém o mesmo código na API', () => {
  const cases = [
    ['telefone', '13991234567', '+5513991234567'],
    ['telefone', '(13) 99123-4567', '+5513991234567'],
    ['telefone', '+55 (13) 99123-4567', '+5513991234567'],
    ['telefone', '5513991234567', '+5513991234567'],
    ['phone', '+1 (202) 555-0100', '+12025550100'],
    ['email', 'Casa+Pix@Example.Invalid', 'casa+pix@example.invalid'],
    ['cnpj', '12.ABC.345/01DE-35', '12ABC34501DE35'],
    ['aleatória', '123E4567-E12B-12D1-A456-426655440000', '123e4567-e12b-12d1-a456-426655440000'],
  ];
  for (const [type, value, expected] of cases) {
    const settings = { ...config, tipo_chave: type, chave_pix: value, cidade: 'Santos' };
    const payload = buildPixPayload(settings, 100, '***', 'Mensalidade');
    assert.equal(fields(fields(payload)['26'])['01'], expected);
    assert.equal(fields(payload)['60'], 'SANTOS');
    assert.equal(buildApiPixPayload(settings, 100, '***', 'Mensalidade'), payload);
  }
  assert.throws(() => normalizePixKey('13991234567'));
  assert.throws(() => normalizePixKey('0034123456789', 'telefone'));
  assert.throws(() => normalizePixKey('chave-aleatoria-errada', 'aleatoria'));
  assert.throws(() => normalizePixKey('pix@example-.invalid', 'email'));
});
test('dados inválidos não produzem QR e a chave longa respeita o limite do campo EMV', () => {
  for (const value of [NaN, Infinity, 0, 0.001, -1]) assert.throws(() => buildPixPayload(config, value, '***', ''));
  assert.throws(() => buildPixPayload({ ...config, chave_pix: 'email-inválido' }, 1, '***', ''));
  assert.throws(() => buildPixPayload({ ...config, nome_beneficiario: ' ' }, 1, '***', ''));
  const key = 'a'.repeat(65) + '@example.com';
  const code = buildPixPayload({ ...config, chave_pix: key }, 1, '***', 'Informação muito longa');
  const top = fields(code);
  assert.equal(top['26'].length, 99);
  assert.equal(fields(top['26'])['01'], key);
});
test('modal Pix separa leitura por QR e cópia em um layout responsivo e acessível', () => {
  const source = readFileSync(new URL('../src/components/PixPaymentModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /role="dialog"/);
  assert.match(source, /margin: 4/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /max-w-\[720px\]/);
  assert.match(source, /md:grid-cols-\[250px_minmax\(0,1fr\)\]/);
  assert.match(source, /Escaneie no aplicativo do banco/);
  assert.match(source, /Copiar código Pix/);
  assert.match(source, /Chave Pix direta/);
  assert.doesNotMatch(source, /max-w-sm/);
});
