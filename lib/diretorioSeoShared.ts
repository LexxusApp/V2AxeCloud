/** SEO compartilhado — diretório de terreiros (prerender, API, front). */

export const SITE_ORIGIN = "https://axecloud.com.br";
export const PORTAL_BRAND = "Portal AxéCloud";

export const STATIC_SITEMAP_PATHS: readonly { path: string; changeFrequency?: string; priority?: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/entrar", changeFrequency: "monthly", priority: 0.9 },
  { path: "/termos", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacidade", changeFrequency: "yearly", priority: 0.5 },
  { path: "/espaco-do-fiel", changeFrequency: "weekly", priority: 0.9 },
  { path: "/conteudo", changeFrequency: "weekly", priority: 0.85 },
  { path: "/conteudo/como-o-axecloud-ajuda-terreiros", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/o-que-e-um-terreiro-guia-para-iniciantes", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/mensalidade-na-casa-de-axe-organizacao", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/giras-festas-e-calendario-da-casa", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/como-visitar-um-terreiro-com-respeito", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/como-instalar-axecloud-celular-pwa", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/melhor-software-terreiro-2026-o-que-avaliar", changeFrequency: "monthly", priority: 0.8 },
  { path: "/conteudo/sistema-para-terreiro-guia-completo", changeFrequency: "monthly", priority: 0.85 },
  { path: "/conteudo/software-para-terreiro-de-umbanda-recursos", changeFrequency: "monthly", priority: 0.85 },
  { path: "/conteudo/gestao-financeira-terreiro-pix-mensalidades", changeFrequency: "monthly", priority: 0.85 },
  { path: "/por-que-axecloud", changeFrequency: "monthly", priority: 0.92 },
  { path: "/conteudo/glossario", changeFrequency: "monthly", priority: 0.8 },
  { path: "/terreiros", changeFrequency: "daily", priority: 0.9 },
  { path: "/eventos", changeFrequency: "daily", priority: 0.85 },
  { path: "/conteudo/calendario-liturgico", changeFrequency: "yearly", priority: 0.75 },
];

export type DiretorioSeoTerreiro = {
  slug: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  fotoUrl: string | null;
  linkMaps: string | null;
  cidade: string | null;
  estado: string | null;
  cidadeSlug: string | null;
  cidadeUrl: string | null;
};

export type DiretorioSeoCidade = {
  cidade: string;
  estado: string | null;
  cidadeSlug: string;
  total: number;
};

export type CityFaqItem = { question: string; answer: string };

export function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function canonicalUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${p}`;
}

export function getCitySeoContent(cidade: string, estado: string | null, total: number): {
  intro: string;
  faq: CityFaqItem[];
} {
  const uf = estado || "SP";
  const loc = `${cidade}, ${uf}`;
  const countLabel = total === 1 ? "1 terreiro listado" : `${total} terreiros listados`;

  const intro = `O diretório público do ${PORTAL_BRAND} reúne ${countLabel} em ${loc} — casas de Umbanda, Candomblé, Jurema e tradições afro-brasileiras com endereço, telefone e rota no Google Maps quando disponível. Use esta página para encontrar um terreiro na região, ver como chegar ou reivindicar o perfil da sua casa no AxéCloud.`;

  const faq: CityFaqItem[] = [
    {
      question: `Quantos terreiros existem em ${cidade}?`,
      answer: `Neste diretório há ${total} registro${total === 1 ? "" : "s"} em ${loc}. A lista é atualizada conforme novas casas são mapeadas e validadas no portal.`,
    },
    {
      question: `Como encontrar um terreiro de Umbanda em ${cidade}?`,
      answer: `Navegue pelos cartões abaixo: cada um mostra nome, endereço, telefone e link para o Google Maps. Você também pode buscar no Google por "terreiro umbanda ${cidade}" e conferir os dados aqui.`,
    },
    {
      question: "Sou zelador(a) — posso atualizar os dados da minha casa?",
      answer: `Sim. Casas listadas podem reivindicar o perfil no AxéCloud, corrigir foto e contatos e aparecer como perfil verificado no diretório. O cadastro oferece teste gratuito de 30 dias do sistema de gestão do terreiro.`,
    },
    {
      question: `Este diretório substitui o Google Maps em ${cidade}?`,
      answer: `Não — complementa. Mantemos referência ao Google Maps para rotas e usamos o portal para quem busca terreiros de axé com contexto sobre tradições afro-brasileiras e gestão da casa.`,
    },
  ];

  return { intro, faq };
}

export function buildLocalBusinessJsonLd(terreiro: DiretorioSeoTerreiro): Record<string, unknown> {
  const url = canonicalUrl(`/terreiro/${terreiro.slug}`);
  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: terreiro.nome,
    url,
    description: `Terreiro de axé em ${[terreiro.cidade, terreiro.estado].filter(Boolean).join(", ")} — diretório ${PORTAL_BRAND}.`,
    address: terreiro.endereco
      ? {
          "@type": "PostalAddress",
          streetAddress: terreiro.endereco,
          addressLocality: terreiro.cidade || undefined,
          addressRegion: terreiro.estado || undefined,
          addressCountry: "BR",
        }
      : undefined,
    telephone: terreiro.telefone || undefined,
    image: terreiro.fotoUrl ? `${SITE_ORIGIN}${terreiro.fotoUrl}` : undefined,
    sameAs: terreiro.linkMaps ? [terreiro.linkMaps] : undefined,
  };
  return Object.fromEntries(Object.entries(json).filter(([, v]) => v !== undefined));
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export type DiretorioPrerenderPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  listLinks?: { href: string; label: string }[];
};

export function buildTerreiroPrerenderPage(terreiro: DiretorioSeoTerreiro): DiretorioPrerenderPage {
  const loc = [terreiro.cidade, terreiro.estado].filter(Boolean).join(", ");
  const path = `/terreiro/${terreiro.slug}`;
  const cidadePath =
    terreiro.estado && terreiro.cidadeSlug
      ? `/terreiros/${terreiro.estado.toLowerCase()}/${terreiro.cidadeSlug}`
      : "/terreiros";

  const sections: { heading: string; body: string }[] = [];
  if (terreiro.endereco) {
    sections.push({ heading: "Endereço", body: terreiro.endereco });
  }
  if (terreiro.telefone) {
    sections.push({ heading: "Telefone", body: terreiro.telefone });
  }
  sections.push({
    heading: "Sobre este diretório",
    body: `${terreiro.nome} está listado no diretório público do ${PORTAL_BRAND}. Zeladores podem reivindicar este perfil para atualizar dados e usar o AxéCloud como sistema de gestão do terreiro.`,
  });

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Diretório", path: "/terreiros" },
    ...(terreiro.cidade
      ? [{ name: terreiro.cidade, path: cidadePath }]
      : []),
    { name: terreiro.nome, path },
  ]);

  return {
    path,
    title: `${terreiro.nome}${loc ? ` — ${loc}` : ""} | Diretório AxéCloud`,
    description: `Informações de ${terreiro.nome}${loc ? ` em ${loc}` : ""}: endereço${terreiro.telefone ? ", telefone" : ""} e rota no Google Maps.`,
    h1: terreiro.nome,
    intro: loc
      ? `Terreiro de axé em ${loc}. Confira endereço, telefone e como chegar.`
      : `Terreiro de axé listado no diretório ${PORTAL_BRAND}.`,
    sections,
    jsonLd: [buildLocalBusinessJsonLd(terreiro), breadcrumbs],
    listLinks: [{ href: cidadePath, label: `Ver terreiros em ${terreiro.cidade || "sua cidade"}` }],
  };
}

export function buildCityPrerenderPage(
  meta: DiretorioSeoCidade,
  terreiros: DiretorioSeoTerreiro[],
): DiretorioPrerenderPage {
  const uf = meta.estado || "SP";
  const path = `/terreiros/${uf.toLowerCase()}/${meta.cidadeSlug}`;
  const { intro, faq } = getCitySeoContent(meta.cidade, meta.estado, meta.total);

  return {
    path,
    title: `Terreiros de Umbanda e Candomblé em ${meta.cidade} - ${uf} | AxéCloud`,
    description: `Encontre ${meta.total} terreiro${meta.total === 1 ? "" : "s"} de Umbanda, Candomblé e tradições afro-brasileiras em ${meta.cidade}, ${uf}. Endereços, telefones e rotas.`,
    h1: `Terreiros em ${meta.cidade}, ${uf}`,
    intro,
    sections: faq.map((f) => ({ heading: f.question, body: f.answer })),
    jsonLd: buildBreadcrumbJsonLd([
      { name: "Diretório", path: "/terreiros" },
      { name: meta.cidade, path },
    ]),
    listLinks: terreiros.slice(0, 30).map((t) => ({
      href: `/terreiro/${t.slug}`,
      label: t.nome,
    })),
  };
}

export function buildDiretorioHeadInject(page: DiretorioPrerenderPage): string {
  const url = canonicalUrl(page.path);
  const jsonLd = page.jsonLd
    ? (Array.isArray(page.jsonLd) ? page.jsonLd : [page.jsonLd])
        .map(
          (block) =>
            `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`,
        )
        .join("\n    ")
    : "";

  return [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="AxéCloud" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/og-image.png" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    jsonLd,
  ]
    .filter(Boolean)
    .join("\n    ");
}

export function buildDiretorioBodyInject(page: DiretorioPrerenderPage): string {
  const sections = page.sections
    .map((s) => `      <h2>${escapeHtml(s.heading)}</h2>\n      <p>${escapeHtml(s.body)}</p>`)
    .join("\n\n");
  const links = (page.listLinks || [])
    .map((l) => `        <li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
    .join("\n");
  const listBlock = links
    ? `      <h2>Terreiros nesta página</h2>\n      <ul>\n${links}\n      </ul>`
    : "";

  return [
    `    <article id="axecloud-seo-static" aria-label="${escapeHtml(page.h1)}">`,
    `      <h1>${escapeHtml(page.h1)}</h1>`,
    `      <p>${escapeHtml(page.intro)}</p>`,
    "",
    sections,
    listBlock,
    `      <nav aria-label="Diretório"><a href="/terreiros">Diretório de terreiros</a></nav>`,
    `    </article>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSitemapXml(
  siteUrl: string,
  routes: { path: string; changeFrequency?: string; priority?: number; lastModified?: string }[],
): string {
  const origin = siteUrl.replace(/\/+$/, "");
  const entries = routes.map((route) => {
    const loc = route.path === "/" ? `${origin}/` : `${origin}${route.path}`;
    const lines = [
      "  <url>",
      `    <loc>${escapeHtml(loc)}</loc>`,
    ];
    if (route.lastModified) lines.push(`    <lastmod>${escapeHtml(route.lastModified)}</lastmod>`);
    if (route.changeFrequency) lines.push(`    <changefreq>${route.changeFrequency}</changefreq>`);
    if (typeof route.priority === "number") {
      lines.push(`    <priority>${Math.min(1, Math.max(0, route.priority)).toFixed(1)}</priority>`);
    }
    lines.push("  </url>");
    return lines.join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

export function buildMinimalSeoHtmlDocument(page: DiretorioPrerenderPage): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${buildDiretorioHeadInject(page)}
  </head>
  <body>
${buildDiretorioBodyInject(page)}
    <p><a href="${escapeHtml(page.path)}">Abrir página completa</a></p>
  </body>
</html>`;
}
