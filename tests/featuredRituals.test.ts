import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isRitualActive, renderFeaturedRituals, renderRitualPage, ritualWhatsAppUrl } from '../scripts/lib/featuredRituals.mjs';

const rituals = JSON.parse(readFileSync(new URL('../cinematic-site/featured-rituals.json', import.meta.url), 'utf8'));
const [azazel, paimon] = rituals;

test('destaques expiram ao terminar o dia do ritual em Brasília, independentemente do fuso do visitante', () => {
  assert.equal(isRitualActive(azazel, new Date('2026-11-03T02:59:59.999Z')), true);
  assert.equal(isRitualActive(azazel, new Date('2026-11-03T03:00:00.000Z')), false);
  assert.equal(isRitualActive(paimon, new Date('2026-11-14T02:59:59.999Z')), true);
  assert.equal(isRitualActive(paimon, new Date('2026-11-14T03:00:00.000Z')), false);
  const middle = renderFeaturedRituals(rituals, new Date('2026-11-03T03:00:00Z'));
  assert.doesNotMatch(middle, /data-ritual-id="azazel-2026"/);
  assert.match(middle, /data-ritual-id="rei-paimon-2026"/);
  assert.equal(renderFeaturedRituals(rituals, new Date('2026-11-14T03:00:00Z')), '');
});

test('cada WhatsApp usa o contato autorizado e identifica o ritual e a data sem inventar modalidade', () => {
  for (const ritual of rituals) {
    const url = new URL(ritualWhatsAppUrl(ritual));
    assert.equal(url.host, 'wa.me');
    assert.equal(url.pathname, '/5511970697597');
    assert.match(url.searchParams.get('text')!, new RegExp(ritual.title));
    assert.ok(url.searchParams.get('text')!.includes(ritual.date.split('-').reverse().join('/')));
    assert.doesNotMatch(url.searchParams.get('text')!, /presencial|online|distância/i);
  }
});

test('link compartilhado de evento vencido continua informativo sem anunciar participação naquele evento', () => {
  const html = renderRitualPage(azazel, new Date('2026-11-03T03:00:00Z'));
  assert.match(html, /A data deste ritual já passou/);
  assert.match(html, /Consultar próximos rituais/);
  assert.doesNotMatch(html, />Tirar dúvidas pelo WhatsApp</);
  assert.doesNotMatch(html, /class="ritual-archive-note" role="status" hidden/);
  assert.match(html, /canonical" href="https:\/\/axecloud.com.br\/eventos\/ritual-com-azazel-2026/);
  assert.match(html, /02 de novembro de 2026/);
});
