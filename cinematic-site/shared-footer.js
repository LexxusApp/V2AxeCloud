/** Cabeçalho e rodapé compartilhados das páginas públicas do AxéCloud. */
(function () {
  const ANO = new Date().getFullYear();
  const CNPJ = "66.335.964/0001-07";
  const path = location.pathname.replace(/\/$/, "") || "/";
  const links = [
    ["Terreiros", "/terreiros"],
    ["Eventos", "/eventos"],
    ["Conteúdo", "/conteudo"],
    ["Por quê?", "/por-que-axecloud"],
    ["Planos", "/#plano"],
  ];
  const active = (href) => href !== "/" && !href.startsWith("/#") && path.startsWith(href);
  const contactUrl = "https://wa.me/5511920033501?text=Ol%C3%A1%2C%20quero%20conhecer%20melhor%20o%20Ax%C3%A9Cloud.";
  const menuLinks = links.map(([label, href]) =>
    `<a href="${href}"${active(href) ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`
  ).join("");

  const header = document.createElement("header");
  header.className = "axe-site-header";
  header.innerHTML = `
    <a class="axe-site-brand" href="/" aria-label="AxéCloud — página inicial">
      <img src="/axecloud-trident.png" alt="" width="36" height="47" />
      <strong><span>Axé</span><em>Cloud</em></strong>
    </a>
    <nav class="axe-site-nav" id="axe-site-menu" aria-label="Navegação principal">
      ${menuLinks}
      <div class="axe-site-mobile-actions">
        <a class="axe-site-mobile-login" href="/entrar">Entrar</a>
        <a href="${contactUrl}" target="_blank" rel="noreferrer">Fale conosco</a>
        <a class="axe-site-mobile-cta" href="/register">Testar 30 dias</a>
      </div>
    </nav>
    <div class="axe-site-actions">
      <a class="axe-site-contact" href="${contactUrl}" target="_blank" rel="noreferrer">Fale conosco</a>
      <a class="axe-site-login" href="/entrar">Entrar</a>
      <a class="axe-site-cta" href="/register">Testar 30 dias <span aria-hidden="true">→</span></a>
      <button class="axe-site-menu-button" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="axe-site-menu"><i></i><i></i><i></i></button>
    </div>`;

  const oldHeader = document.querySelector("body > nav, body > .navegacao");
  if (oldHeader) oldHeader.replaceWith(header);
  else document.body.insertAdjacentElement("afterbegin", header);
  document.body.classList.add("axe-shell-ready");

  const button = header.querySelector(".axe-site-menu-button");
  const menu = header.querySelector(".axe-site-nav");
  const closeMenu = () => {
    header.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Abrir menu");
  };
  button.addEventListener("click", () => {
    const opened = header.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(opened));
    button.setAttribute("aria-label", opened ? "Fechar menu" : "Abrir menu");
  });
  menu.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("pointerdown", (event) => { if (!header.contains(event.target)) closeMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  const footer = `
    <footer class="axe-site-footer" role="contentinfo">
      <div class="axe-site-footer-main">
        <a class="axe-site-footer-brand" href="/">
          <img src="/axecloud-trident.png" alt="" width="38" height="49" />
          <strong><span>Axé</span><em>Cloud</em></strong>
        </a>
        <p>Gestão profissional para casas de Umbanda, Candomblé e Jurema.</p>
        <nav aria-label="Links do rodapé">
          <a href="/#casa">Recursos</a><a href="/terreiros">Terreiros</a><a href="/eventos">Eventos</a><a href="/conteudo">Conteúdo</a><a href="/privacidade">Privacidade</a><a href="/termos">Termos</a>
        </nav>
      </div>
      <div class="axe-site-footer-bottom"><span>© ${ANO} AxéCloud · CNPJ ${CNPJ}</span><span>Com respeito às tradições de matriz africana.</span><a href="/">Voltar ao início ↑</a></div>
    </footer>`;
  const target = document.getElementById("site-footer");
  const oldFooter = document.querySelector("footer.rodape, footer.site-footer");
  if (target) target.outerHTML = footer;
  else if (oldFooter) oldFooter.outerHTML = footer;
  else document.body.insertAdjacentHTML("beforeend", footer);

  const main = document.querySelector("main");
  if (main && !main.id) main.id = "conteudo-principal";
  if (main && !document.querySelector(".pular-conteudo")) {
    document.body.insertAdjacentHTML("afterbegin", '<a class="pular-conteudo" href="#conteudo-principal">Pular para o conteúdo</a>');
  }

  window.dataLayer = window.dataLayer || [];
  window.axeTrack = window.axeTrack || ((evento, dados = {}) => {
    window.dataLayer.push({ event: evento, ...dados, path: location.pathname, timestamp: Date.now() });
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    if (link.matches('[href="/register"], [href*="/register"]')) window.axeTrack("cta_trial_click", { label: link.textContent.trim() });
    else if (link.matches('[href="/entrar"], [href*="/entrar"]')) window.axeTrack("login_click", { label: link.textContent.trim() });
    else if (link.matches('[href*="wa.me/5511920033501"]')) window.axeTrack("commercial_whatsapp_click", { label: link.textContent.trim() });
    else if (link.matches('[href^="/terreiros"]')) window.axeTrack("directory_click", { destination: link.getAttribute("href") });
  });
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) window.axeTrack("web_vital_lcp", { value: Math.round(last.startTime) });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch { /* navegadores sem PerformanceObserver */ }
})();
