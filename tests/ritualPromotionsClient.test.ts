import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../cinematic-site/rituais.js', import.meta.url), 'utf8');

test('página já entregue retira os destaques vencidos e conserva apenas o contato para próximos rituais', () => {
  let now = Date.parse('2026-11-02T23:59:00-03:00');
  const deadline = '2026-11-03T00:00:00-03:00';
  const card = { dataset: { ritualId: 'azazel-2026', ritualUntil: deadline }, hidden: false, hasAttribute: () => false };
  const note = { hidden: true };
  const button = { href: 'https://wa.me/current', dataset: { upcomingUrl: 'https://wa.me/upcoming' }, textContent: 'Tirar dúvidas pelo WhatsApp', classList: { contains: () => true } };
  const detail = { dataset: card.dataset, hasAttribute: () => true, querySelector: () => note, querySelectorAll: () => [button] };
  const section = { hidden: false, querySelector: () => card.hidden ? null : card };
  const listeners: Record<string, () => void> = {};
  let interval: () => void = () => {};
  const document = {
    readyState: 'loading', hidden: false,
    querySelectorAll: () => [card, detail], querySelector: () => section,
    addEventListener: (name: string, callback: () => void) => { listeners[name] = callback; },
  };
  runInNewContext(source, { document, window: {}, Date: { now: () => now, parse: Date.parse }, setInterval: (callback: () => void) => { interval = callback; } });
  assert.equal(card.hidden, false);
  assert.equal(note.hidden, true);
  now = Date.parse(deadline);
  interval();
  assert.equal(card.hidden, true);
  assert.equal(section.hidden, true);
  assert.equal(note.hidden, false);
  assert.equal(button.href, 'https://wa.me/upcoming');
  assert.equal(button.textContent, 'Consultar próximos rituais');
  listeners.visibilitychange();
  assert.equal(section.hidden, true);
});

test('primeira impressão aguarda scripts deferidos e é registrada uma vez; clique identifica o destino', () => {
  const events: unknown[][] = [];
  const entry = { dataset: { ritualId: 'rei-paimon-2026', ritualUntil: '2026-11-14T00:00:00-03:00' }, hidden: false, hasAttribute: () => false };
  const listeners: Record<string, (value?: unknown) => void> = {};
  let observerCreated = false;
  let onVisibility: (items: unknown[]) => void = () => {};
  const window: { IntersectionObserver: unknown; axeTrack?: (...args: unknown[]) => void } = { IntersectionObserver: true };
  class IntersectionObserver {
    constructor(callback: (items: unknown[]) => void) { observerCreated = true; onVisibility = callback; }
    observe() {}
    unobserve() {}
  }
  const document = { readyState: 'interactive', querySelectorAll: () => [entry], querySelector: () => null, addEventListener: (name: string, callback: (value?: unknown) => void) => { listeners[name] = callback; } };
  runInNewContext(source, { document, window, IntersectionObserver, Date: { now: () => Date.parse('2026-10-25T12:00:00Z'), parse: Date.parse }, setInterval() {} });
  assert.equal(observerCreated, false);
  window.axeTrack = (...args) => { events.push(args); };
  listeners.DOMContentLoaded();
  onVisibility([{ target: entry, isIntersecting: true, intersectionRatio: .06 }]);
  assert.equal(events.length, 0);
  onVisibility([{ target: entry, isIntersecting: true, intersectionRatio: .5 }]);
  onVisibility([{ target: entry, isIntersecting: true, intersectionRatio: 1 }]);
  const link = { dataset: { ritualAction: 'details' }, pathname: '/eventos/ritual-com-rei-paimon-2026', closest: () => entry };
  listeners.click({ target: { closest: () => link } });
  assert.equal(events.length, 2);
  assert.equal(events[0][0], 'ritual_promotion_view');
  assert.equal(events[1][0], 'ritual_promotion_details');
  assert.equal((events[1][1] as { promotionId: string }).promotionId, 'rei-paimon-2026');
  assert.equal((events[1][1] as { destination: string }).destination, link.pathname);
});
