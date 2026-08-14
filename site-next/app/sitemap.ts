import type { MetadataRoute } from "next";

const origin = "https://axecloud.com.br";

// Fallback for standalone previews. In production, the existing API sitemap is
// authoritative because it also includes every city, neighbourhood and terreiro.
const publicRoutes = [
  "", "/termos", "/privacidade", "/espaco-do-fiel", "/conteudo",
  "/conteudo/gestao-de-terreiros", "/conteudo/como-o-axecloud-ajuda-terreiros",
  "/conteudo/o-que-e-um-terreiro-guia-para-iniciantes",
  "/conteudo/mensalidade-na-casa-de-axe-organizacao",
  "/conteudo/giras-festas-e-calendario-da-casa",
  "/conteudo/como-visitar-um-terreiro-com-respeito",
  "/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro",
  "/conteudo/como-instalar-axecloud-celular-pwa",
  "/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro",
  "/conteudo/melhor-software-terreiro-2026-o-que-avaliar",
  "/conteudo/sistema-para-terreiro-guia-completo",
  "/conteudo/software-para-terreiro-de-umbanda-recursos",
  "/conteudo/gestao-financeira-terreiro-pix-mensalidades",
  "/conteudo/como-cobrar-mensalidade-terreiro-sem-constranger",
  "/conteudo/como-organizar-presenca-em-gira",
  "/conteudo/vale-a-pena-software-terreiro-pequeno",
  "/conteudo/portal-filho-de-santo-no-celular",
  "/conteudo/o-que-sistema-terreiro-precisa-ter-2026",
  "/por-que-axecloud", "/por-que-axecloud/vs-planilhas", "/recursos",
  "/terreiros", "/eventos",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((path) => ({
    url: `${origin}${path || "/"}`,
    ...(path === "" ? { lastModified: new Date("2026-08-14T00:00:00-03:00") } : {}),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/terreiros" || path === "/conteudo" ? 0.9 : 0.7,
  }));
}
