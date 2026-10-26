/* Expiração em horário de Brasília e métricas agregadas da divulgação. */
(() => {
  const entries = [...document.querySelectorAll('[data-ritual-id][data-ritual-until]')];
  if (!entries.length) return;
  const seen = new Set();
  const track = (event, entry, extra = {}) => {
    if (typeof window.axeTrack !== 'function') return false;
    window.axeTrack(event, { promotionId: entry.dataset.ritualId, surface: entry.hasAttribute('data-ritual-detail') ? 'ritual_page' : 'directory', ...extra });
    return true;
  };
  const expire = () => {
    for (const entry of entries) {
      if (Date.now() < Date.parse(entry.dataset.ritualUntil)) continue;
      if (!entry.hasAttribute('data-ritual-detail')) {
        entry.hidden = true;
        continue;
      }
      const note = entry.querySelector('.ritual-archive-note');
      if (note) note.hidden = false;
      entry.querySelectorAll('[data-upcoming-url]').forEach((link) => {
        link.href = link.dataset.upcomingUrl;
        if (link.classList.contains('ritual-whatsapp')) link.textContent = 'Consultar próximos rituais';
      });
    }
    const section = document.querySelector('.ritual-promotions');
    if (section) section.hidden = !section.querySelector('.ritual-promotion:not([hidden])');
  };
  expire();
  // Reavalia também quando uma aba fica aberta durante a virada do dia.
  setInterval(expire, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) expire(); });
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-ritual-action]');
    const entry = link?.closest('[data-ritual-id]');
    if (!entry) return;
    track(`ritual_promotion_${link.dataset.ritualAction}`, entry, { destination: link.pathname, archived: Date.now() >= Date.parse(entry.dataset.ritualUntil) });
  });
  const observeViews = () => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((items) => {
      for (const item of items) {
        if (!item.isIntersecting || item.intersectionRatio < .5 || seen.has(item.target) || item.target.hidden) continue;
        if (!track('ritual_promotion_view', item.target)) continue;
        seen.add(item.target);
        observer.unobserve(item.target);
      }
    }, { threshold: .5 });
    entries.forEach((entry) => observer.observe(entry));
  };
  // A ponte de métricas também é deferida; aguarda todos os scripts antes da primeira impressão.
  if (document.readyState === 'complete') observeViews();
  else document.addEventListener('DOMContentLoaded', observeViews, { once: true });
})();
