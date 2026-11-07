import assert from 'node:assert/strict';
import test from 'node:test';

import { extractBairroFromEndereco } from '../lib/diretorioBairro';
import { buildTerreiroPrerenderPage } from '../lib/diretorioSeoShared';

test('Brasil no fim do endereço não é confundido com bairro Brás', () => {
  assert.equal(
    extractBairroFromEndereco(
      'Rua Ildefonso Clemente Puppi, 94 - Cidade Industrial de Curitiba, Curitiba - PR, 81350-719, Brasil',
      'Curitiba',
    ),
    null,
  );
  assert.equal(
    extractBairroFromEndereco(
      'Av. Primeiro de Maio, 844 - Vila Hidraulica, Rio Grande - RS, 96211-670, Brasil',
      'Rio Grande',
    ),
    null,
  );
});

test('Brás continua reconhecido quando realmente pertence a São Paulo', () => {
  assert.equal(
    extractBairroFromEndereco(
      'R. do Gasômetro, 500 - Brás, São Paulo - SP, 03004-000, Brasil',
      'São Paulo',
    ),
    'Brás',
  );
});

test('perfil SEO usa coordenadas, contexto da cidade e casas próximas sem depender de bairro', () => {
  const page = buildTerreiroPrerenderPage(
    {
      slug: 'casa-exemplo',
      nome: 'Casa Exemplo de Umbanda',
      endereco: 'Rua Exemplo, 100 - Centro, Campinas - SP, Brasil',
      telefone: '(19) 99999-0000',
      fotoUrl: '/foto.jpg',
      linkMaps: 'https://www.google.com/maps/place/casa-exemplo',
      cidade: 'Campinas',
      estado: 'SP',
      cidadeSlug: 'campinas',
      cidadeUrl: '/terreiros/sp/campinas',
      latitude: -22.9056,
      longitude: -47.0608,
    },
    {
      indexable: true,
      cityTotal: 139,
      siblingTerreiros: [
        {
          slug: 'casa-vizinha',
          nome: 'Casa Vizinha',
          endereco: 'Rua Vizinha, 20 - Campinas - SP, Brasil',
          telefone: null,
          fotoUrl: null,
          linkMaps: null,
          cidade: 'Campinas',
          estado: 'SP',
          cidadeSlug: 'campinas',
          cidadeUrl: '/terreiros/sp/campinas',
          latitude: -22.9060,
          longitude: -47.0612,
        },
      ],
    },
  );

  assert.match(page.intro, /139 casas/i);
  assert.ok(page.sections.some((section) => /Casas próximas em Campinas/.test(section.heading)));
  assert.ok(page.listLinks?.some((link) => link.href === '/terreiro/casa-vizinha' && /~/.test(link.label)));

  const blocks = Array.isArray(page.jsonLd) ? page.jsonLd : [page.jsonLd];
  const business = blocks.find((block) => block?.['@type'] === 'LocalBusiness');
  assert.deepEqual(business?.geo, {
    '@type': 'GeoCoordinates',
    latitude: -22.9056,
    longitude: -47.0608,
  });
});
