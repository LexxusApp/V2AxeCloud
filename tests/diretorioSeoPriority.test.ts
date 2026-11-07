import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diretorioSeoPriorityScore,
  isDiretorioSeoPriorityCity,
  selectDiretorioSeoPriorityProfiles,
} from '../lib/diretorioSeoPriority';

function house(
  slug: string,
  cidadeSlug: string,
  extras: Record<string, unknown> = {},
) {
  return {
    slug,
    nome: `Terreiro ${slug}`,
    cidade: cidadeSlug.replace(/-/g, ' '),
    estado: 'SP',
    cidadeSlug,
    endereco: `Rua ${slug}, 100 - Centro`,
    linkMaps: `https://maps.google.com/?q=${slug}`,
    tipo: 'terreiro',
    fotoUrl: `/foto/${slug}.jpg`,
    latitude: -23.5,
    longitude: -46.6,
    ...extras,
  };
}

test('score SEO favorece perfil conectado, verificado e com conteúdo próprio', () => {
  const plain = house('plain', 'cidade-a');
  const rich = house('rich', 'cidade-a', {
    gerenciada: true,
    verificada: true,
    telefone: '(11) 99999-0000',
    descricao: 'Descrição própria da casa com informações de visita, tradição, atividades e contexto local suficiente para diferenciar o perfil.',
    instagramUrl: 'https://instagram.com/casa',
    horariosGira: [{ dia: 'sábado' }],
  });

  assert.ok(diretorioSeoPriorityScore(rich, 20) > diretorioSeoPriorityScore(plain, 20) + 300);
});

test('primeira leva preserva perfis oficiais e dá cobertura a cidades com massa crítica', () => {
  const rows = [
    house('a1', 'cidade-a'),
    house('a2', 'cidade-a', { telefone: '(11) 99999-0000' }),
    house('a3', 'cidade-a'),
    house('b1', 'cidade-b', { descricao: 'Descrição própria com dados adicionais para a casa e seus visitantes.' }),
    house('b2', 'cidade-b'),
    house('oficial', 'cidade-c', { gerenciada: true }),
  ];

  const selected = selectDiretorioSeoPriorityProfiles(rows, { limit: 3, minCityProfiles: 3 });

  assert.equal(selected.size, 3);
  assert.equal(selected.has('oficial'), true);
  assert.equal(['a1', 'a2', 'a3'].some((slug) => selected.has(slug)), true);
});

test('cidade entra no sitemap prioritário com 3+ perfis ou quando abriga perfil prioritário', () => {
  const cityLarge = [house('a1', 'cidade-a'), house('a2', 'cidade-a'), house('a3', 'cidade-a')];
  const citySmall = [house('b1', 'cidade-b'), house('b2', 'cidade-b')];

  assert.equal(isDiretorioSeoPriorityCity(cityLarge, new Set()), true);
  assert.equal(isDiretorioSeoPriorityCity(citySmall, new Set()), false);
  assert.equal(isDiretorioSeoPriorityCity(citySmall, new Set(['b2'])), true);
});
