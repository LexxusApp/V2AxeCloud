/* Integra o marketing cinematográfico às métricas e ao ciclo de vida da produção. */
(function () {
  const VISITOR_KEY = "axecloud_public_vid";
  const SESSION_KEY = "axecloud_conversion_sid";
  const ATTRIBUTION_KEY = "axecloud_conversion_attribution";

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      const value = char === "x" ? random : (random & 3) | 8;
      return value.toString(16);
    });
  }

  function storageGet(storage, key) {
    try { return storage.getItem(key); } catch { return null; }
  }
  function storageSet(storage, key, value) {
    try { storage.setItem(key, value); } catch { /* navegador restritivo */ }
  }
  function stableId(storage, key) {
    const current = storageGet(storage, key);
    if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
    const created = uuid();
    storageSet(storage, key, created);
    return created;
  }

  function attribution() {
    const stored = storageGet(localStorage, ATTRIBUTION_KEY);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* recria abaixo */ }
    }
    const params = new URLSearchParams(location.search);
    const value = {
      source: params.get("utm_source") || undefined,
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
      content: params.get("utm_content") || undefined,
      term: params.get("utm_term") || undefined,
      landingPath: `${location.pathname}${location.search}`.slice(0, 500),
    };
    storageSet(localStorage, ATTRIBUTION_KEY, JSON.stringify(value));
    return value;
  }

  const visitorId = stableId(localStorage, VISITOR_KEY);
  const sessionId = stableId(sessionStorage, SESSION_KEY);
  window.dataLayer = window.dataLayer || [];

  function conversion(eventName, details = {}) {
    const allowed = new Set(["landing_view", "section_view", "cta_click", "directory_performance"]);
    if (!allowed.has(eventName)) return;
    void fetch("/api/metrics/conversion-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        visitorId,
        sessionId,
        path: location.pathname,
        referrer: document.referrer || null,
        attribution: attribution(),
        ctaId: details.ctaId,
        ctaLabel: details.ctaLabel,
        metadata: details.metadata,
      }),
    }).catch(() => {});
  }

  window.axeTrack = function axeTrack(event, data = {}) {
    window.dataLayer.push({ event, ...data, path: location.pathname, timestamp: Date.now() });
    if (event === "cta_trial_click" || event === "login_click" || event === "directory_click") {
      conversion("cta_click", {
        ctaId: event,
        ctaLabel: data.label || data.destination || event,
        metadata: data,
      });
    }
    if (event === "web_vital_lcp" && location.pathname === "/terreiros") {
      conversion("directory_performance", { metadata: { lcpMs: data.value } });
    }
  };

  async function purgeLegacyServiceWorker() {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch { /* não bloqueia o marketing */ }
  }

  function trackVisit() {
    const day = new Date().toISOString().slice(0, 10);
    const marker = `axecloud_public_visit:${day}:${location.pathname}`;
    if (storageGet(sessionStorage, marker)) return;
    void fetch("/api/metrics/public-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ visitorId, path: location.pathname, referrer: document.referrer || null }),
    }).then((response) => { if (response.ok) storageSet(sessionStorage, marker, "1"); }).catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", () => {
    void purgeLegacyServiceWorker();
    trackVisit();
    conversion("landing_view");

    const seen = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        const section = entry.target.id || entry.target.getAttribute("aria-label") || "section";
        conversion("section_view", { metadata: { section } });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
  }, { once: true });
})();
