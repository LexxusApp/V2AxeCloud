import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGiraVisualTheme } from '../src/lib/giraVisualTheme';

const event = (titulo: string, id = titulo) => ({ id, titulo, data: '2026-09-30' });

test('reconhece os temas litúrgicos mais comuns pelo título da gira', () => {
  assert.equal(resolveGiraVisualTheme(event('Gira de Exu')).id, 'exu');
  assert.equal(resolveGiraVisualTheme(event('Festa de Erê e Ibeji')).id, 'ere');
  assert.equal(resolveGiraVisualTheme(event('Gira de Caboclo')).id, 'caboclo');
  assert.equal(resolveGiraVisualTheme(event('Homenagem a Iemanjá')).id, 'iemanja');
  assert.equal(resolveGiraVisualTheme(event('Gira de Preto Velho')).id, 'preto-velho');
});

test('mantém a variante visual estável para o mesmo evento', () => {
  const first = resolveGiraVisualTheme(event('Gira mensal', 'evento-fixo'));
  const second = resolveGiraVisualTheme(event('Gira mensal', 'evento-fixo'));
  assert.equal(first.id, 'default');
  assert.equal(first.variant, second.variant);
});
