/**
 * Rodapé institucional do AxéCloud (reproduz MarketingMockupFooter da produção).
 * Inclua shared-footer.css + este arquivo em qualquer página.
 * Se existir <footer class="rodape"> ou #site-footer, substitui / preenche.
 */
/* Fonte versionada para o build de produção. */
(function () {
  const ANO = new Date().getFullYear();
  const CNPJ = "66.335.964/0001-07";

  const html = `
<footer class="site-footer" role="contentinfo">
  <div class="site-footer-grade">
    <div>
      <a class="site-footer-marca" href="/">Axé<em>Cloud</em></a>
      <p class="site-footer-desc">Portal e software para terreiros de Umbanda, Candomblé e Jurema — casas, eventos públicos, pedidos de reza e gestão da casa.</p>
      <ul class="site-footer-sociais" aria-label="Redes sociais oficiais">
        <li>
          <a href="https://www.instagram.com/axecloudoficial/" target="_blank" rel="me noopener noreferrer" aria-label="Instagram @axecloudoficial">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
        </li>
        <li>
          <a href="https://www.tiktok.com/@axecloudoficial" target="_blank" rel="me noopener noreferrer" aria-label="TikTok @axecloudoficial">
            <svg class="tiktok-icon" viewBox="0 0 24 24"><path d="M19.6 7.4a5.4 5.4 0 0 1-3.3-1.2v7.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V2h2.8a5.4 5.4 0 0 0 3.2 3.2V7.4Z"/></svg>
          </a>
        </li>
      </ul>
    </div>

    <div>
      <h2>Portal</h2>
      <ul>
        <li><a href="/terreiros">Terreiros</a></li>
        <li><a href="/eventos">Eventos públicos</a></li>
        <li><a href="/espaco-do-fiel">Pedir reza</a></li>
        <li><a href="/conteudo/calendario-liturgico">Calendário de referências</a></li>
      </ul>
    </div>

    <div>
      <h2>Plataforma</h2>
      <ul>
        <li><a href="/#gira">Recursos</a></li>
        <li><a href="/por-que-axecloud">Por que AxéCloud</a></li>
        <li><a href="/register">Teste grátis 30 dias</a></li>
        <li><a href="/#planos">Planos</a></li>
      </ul>
    </div>

    <div>
      <h2>Conta</h2>
      <ul>
        <li><a href="/entrar">Entrar</a></li>
        <li><a href="/register">Cadastrar terreiro</a></li>
        <li><a href="/conteudo">Conteúdo</a></li>
        <li><a href="/conteudo/glossario">Glossário do axé</a></li>
      </ul>
    </div>

    <div>
      <h2>Legal</h2>
      <ul>
        <li><a href="/#seguranca">Segurança e LGPD</a></li>
        <li><a href="/termos">Termos de Uso</a></li>
        <li><a href="/privacidade">Política de Privacidade</a></li>
      </ul>
    </div>
  </div>

  <div class="site-footer-baixo">
    <p>© ${ANO} AxéCloud — CNPJ: ${CNPJ}</p>
    <p class="italico">Axé — com respeito às tradições de matriz africana.</p>
  </div>
</footer>`;

  const alvo = document.getElementById("site-footer");
  const antigo = document.querySelector("footer.rodape");
  if (alvo) {
    alvo.outerHTML = html;
  } else if (antigo) {
    antigo.outerHTML = html;
  } else {
    document.body.insertAdjacentHTML("beforeend", html);
  }

  const main = document.querySelector("main");
  if (main && !main.id) main.id = "conteudo-principal";
  if (main && !document.querySelector(".pular-conteudo")) {
    document.body.insertAdjacentHTML("afterbegin", '<a class="pular-conteudo" href="#conteudo-principal">Pular para o conteúdo</a>');
  }

  const topo = document.querySelector(".navegacao, body > nav");
  const menu = topo?.querySelector(".nav-links, .menu");
  if (topo && menu) {
    if (!menu.querySelector(".menu-cta")) {
      const cta = document.createElement("a");
      cta.href = "/register";
      cta.className = "menu-cta";
      cta.textContent = "Teste grátis 30 dias";
      menu.appendChild(cta);
    }
    menu.id ||= "menu-principal";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "menu-mobile-botao";
    botao.setAttribute("aria-controls", menu.id);
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-label", "Abrir menu principal");
    botao.innerHTML = '<span></span><span></span><span></span>';
    (topo.querySelector(".nav-acoes") || topo).appendChild(botao);
    const fechar = () => {
      document.body.classList.remove("menu-aberto");
      botao.setAttribute("aria-expanded", "false");
      botao.setAttribute("aria-label", "Abrir menu principal");
    };
    botao.addEventListener("click", () => {
      const aberto = document.body.classList.toggle("menu-aberto");
      botao.setAttribute("aria-expanded", String(aberto));
      botao.setAttribute("aria-label", aberto ? "Fechar menu principal" : "Abrir menu principal");
    });
    menu.addEventListener("click", (event) => { if (event.target.closest("a")) fechar(); });
    document.addEventListener("pointerdown", (event) => {
      if (document.body.classList.contains("menu-aberto") && !topo.contains(event.target)) fechar();
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") fechar(); });
    window.addEventListener("resize", () => { if (window.innerWidth > 1120) fechar(); });
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
    else if (link.matches('[href*="wa.me/5511912276156"]')) window.axeTrack("commercial_whatsapp_click", { label: link.textContent.trim() });
    else if (link.matches('[href^="/terreiros"]')) window.axeTrack("directory_click", { destination: link.getAttribute("href") });
  });
  try {
    new PerformanceObserver((list) => {
      const ultimo = list.getEntries().at(-1);
      if (ultimo) window.axeTrack("web_vital_lcp", { value: Math.round(ultimo.startTime) });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch { /* API indisponível em navegadores antigos */ }
})();
