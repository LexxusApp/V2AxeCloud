import assert from 'node:assert/strict';
import test from 'node:test';

import { linkifyAxecloudArticleBody } from '../src/lib/seoLinkify';

test('link interno de recurso não cria âncora aninhada nem URL malformada', () => {
  const html = linkifyAxecloudArticleBody(
    'Veja https://axecloud.com.br/recursos/financeiro-pix-mensalidades e https://axecloud.com.br/recursos.',
  );

  assert.match(html, /href="https:\/\/axecloud\.com\.br\/recursos\/financeiro-pix-mensalidades"/);
  assert.match(html, /href="https:\/\/axecloud\.com\.br\/recursos"/);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.equal(html.includes('<a href="<a href='), false);
  assert.equal(html.includes('/recursos/%3Ca'), false);
});

test('link comercial recebe âncora descritiva e texto externo continua escapado', () => {
  const html = linkifyAxecloudArticleBody(
    'Conheça https://axecloud.com.br/sistema-de-gestao-para-terreiros <script>alert(1)</script>.',
  );

  assert.match(html, />sistema de gestão para terreiros<\/a>/);
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
});
