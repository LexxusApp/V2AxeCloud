import os

html_path = 'AxecloudV2/cinematic-site/terreiros.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update garanteMapa to call inicializaControlesFita
old_garante = """  snapMapaPixel();
  window.addEventListener("resize", snapMapaPixel);
}"""

new_garante = """  snapMapaPixel();
  window.addEventListener("resize", snapMapaPixel);
  inicializaControlesFita();
}"""

# 2. Add renderizaFitaFlutuante and inicializaControlesFita, and update aplicaPontosNoMapa
old_aplica = """function aplicaPontosNoMapa(pontos, { ajustarVista = true } = {}) {
  if (!window.L) return;
  garanteMapa();
  if (filtroMapa === "verified") pontos = pontos.filter((p) => p.verificada);
  pontosAtivos = pontos;
  camadaPontos.setPoints(pontos);

  const nota = $("#mapa-nota");"""

new_aplica = """function renderizaFitaFlutuante(pontos) {
  const dock = document.getElementById("map-ribbon-dock");
  const track = document.getElementById("map-ribbon-track");
  const totalEl = document.getElementById("ribbon-total");
  const filterCountEl = document.getElementById("map-verified-count");
  if (!dock || !track) return;

  const candidatos = (pontos && pontos.length) ? pontos : todosPontos;
  const oficiais = candidatos.filter((p) => p.verificada);
  const totalGeralOficiais = todosPontos.filter((p) => p.verificada).length;

  if (totalEl) totalEl.textContent = oficiais.length ? `(${oficiais.length})` : "";
  if (filterCountEl) filterCountEl.textContent = totalGeralOficiais ? `(${totalGeralOficiais})` : "";

  if (!oficiais.length) {
    dock.style.display = "none";
    return;
  }
  dock.style.display = "flex";

  track.innerHTML = oficiais.map((p) => {
    const local = [p.cidade, p.estado].filter(Boolean).join(" · ");
    return `
      <article class="ribbon-card" data-slug="${esc(p.slug)}" data-lat="${p.lat}" data-lng="${p.lng}">
        <div class="ribbon-card-head">
          <span class="ribbon-badge"><span class="ribbon-dot"></span> Oficial</span>
          <span class="ribbon-city">${esc(local)}</span>
        </div>
        <h4 class="ribbon-card-name" title="${esc(p.nome)}">${esc(p.nome)}</h4>
        <div class="ribbon-card-actions">
          <button type="button" class="ribbon-action-fly" data-action="fly" title="Ver localização exata no mapa">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
            Ver no mapa
          </button>
          <a href="${esc(p.perfilUrl)}" class="ribbon-action-profile" title="Abrir perfil completo da casa">
            Perfil →
          </a>
        </div>
      </article>
    `;
  }).join("");

  track.querySelectorAll(".ribbon-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      const link = e.target.closest(".ribbon-action-profile");
      if (link) return;
      e.preventDefault();
      const slug = card.dataset.slug;
      const lat = Number(card.dataset.lat);
      const lng = Number(card.dataset.lng);
      const point = todosPontos.find((p) => p.slug === slug);
      if (!point || !mapa) return;

      track.querySelectorAll(".ribbon-card").forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");

      mapa.flyTo([lat, lng], 15, { duration: 0.85 });
      window.setTimeout(() => abrePopupPonto(point), 550);
    });
  });
}

let controlesFitaIniciados = false;
function inicializaControlesFita() {
  if (controlesFitaIniciados) return;
  controlesFitaIniciados = true;
  const track = document.getElementById("map-ribbon-track");
  const prev = document.getElementById("ribbon-scroll-prev");
  const next = document.getElementById("ribbon-scroll-next");
  const toggle = document.getElementById("ribbon-toggle-btn");
  const dock = document.getElementById("map-ribbon-dock");

  if (prev && track) {
    prev.addEventListener("click", (e) => {
      e.stopPropagation();
      track.scrollBy({ left: -260, behavior: "smooth" });
    });
  }
  if (next && track) {
    next.addEventListener("click", (e) => {
      e.stopPropagation();
      track.scrollBy({ left: 260, behavior: "smooth" });
    });
  }
  if (toggle && dock) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      dock.classList.toggle("is-collapsed");
      toggle.textContent = dock.classList.contains("is-collapsed") ? "+" : "−";
      toggle.title = dock.classList.contains("is-collapsed") ? "Expandir fita" : "Recolher fita";
    });
  }
}

function aplicaPontosNoMapa(pontos, { ajustarVista = true } = {}) {
  if (!window.L) return;
  garanteMapa();
  if (filtroMapa === "verified") pontos = pontos.filter((p) => p.verificada);
  pontosAtivos = pontos;
  camadaPontos.setPoints(pontos);
  renderizaFitaFlutuante(pontosAtivos);

  const nota = $("#mapa-nota");"""

# 3. Update desenha() so when filtroMapa === 'verified', the list below also filters to verified
old_desenha_filtrados = """  const filtrados = t
    ? itens.filter((i) =>
        normalizaBusca(i.nome).includes(t) ||
        normalizaBusca(i.bairro).includes(t) ||
        normalizaBusca(i.cidade).includes(t) ||
        normalizaBusca(i.endereco).includes(t))
    : itens;"""

new_desenha_filtrados = """  let filtrados = t
    ? itens.filter((i) =>
        normalizaBusca(i.nome).includes(t) ||
        normalizaBusca(i.bairro).includes(t) ||
        normalizaBusca(i.cidade).includes(t) ||
        normalizaBusca(i.endereco).includes(t))
    : itens;

  if (filtroMapa === "verified") {
    filtrados = filtrados.filter((i) => i.verificada);
  }"""

html_clean = html.replace('\r\n', '\n')

for name, target, repl in [
    ('garante', old_garante.replace('\r\n', '\n'), new_garante.replace('\r\n', '\n')),
    ('aplica', old_aplica.replace('\r\n', '\n'), new_aplica.replace('\r\n', '\n')),
    ('desenha_filtrados', old_desenha_filtrados.replace('\r\n', '\n'), new_desenha_filtrados.replace('\r\n', '\n')),
]:
    if target in html_clean:
        html_clean = html_clean.replace(target, repl)
        print(f"[{name}] Replaced successfully!")
    else:
        print(f"[{name}] Target NOT found!")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_clean)

print("Updated terreiros.html with ribbon logic successfully!")
