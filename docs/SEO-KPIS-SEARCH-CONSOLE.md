# KPIs SEO — Search Console + Google Business Profile

Rotina semanal (~10 min) para acompanhar o plano SEO de 90 dias do AxéCloud.  
Baseline: **28/jun/2026** (Fase 1 comparativo + Fase 2 conteúdo · **21 URLs** no sitemap).

Imprimir checklist no terminal:

```bash
npm run seo:kpi-checklist
```

---

## 1. Google Search Console

Propriedade: **https://axecloud.com.br/** (prefixo de URL)  
Sitemap: **https://axecloud.com.br/sitemap.xml**

### Métricas globais (todo domingo)

| KPI | Onde no GSC | Meta 90 dias | Meta 6 meses |
|-----|-------------|--------------|--------------|
| Impressões totais | Performance → 28 dias | +20% vs baseline | Crescimento estável |
| Cliques totais | Performance → 28 dias | +15% vs baseline | — |
| CTR médio | Performance | ≥ 3,5% | ≥ 4% |
| Posição média | Performance | ≤ 12 (termos mistos) | ≤ 8 |
| Páginas indexadas | Indexação → Páginas | **25+** | **40+** |

### Grupos de consulta

Filtro: **Performance → Resultados da pesquisa → + Novo → Consulta → Contém**

| Grupo | Exemplos de filtro | Meta 90 dias |
|-------|-------------------|--------------|
| **Marca** | `axecloud`, `axécloud` | Posição ≤ 1,5 · CTR ≥ 35% |
| **Produto genérico** | `software terreiro`, `gestão terreiro`, `sistema terreiro` | Impressões +30% · posição ≤ 8 |
| **Funcionalidade** | `mensalidade pix`, `portal filho de santo`, `pwa terreiro` | ≥ 1 URL `/conteudo/` com impressões |
| **Comparativo** | `melhor software terreiro`, `planilha terreiro` | `/por-que-axecloud` ≥ 50 imp/mês |

Definições completas em `src/constants/seoKpis.ts`.

### Páginas para comparar CTR

Filtro: **Performance → Página → Igual a**

| Página | O que observar |
|--------|----------------|
| `/` | Baseline de marca e termos amplos |
| `/por-que-axecloud` | CTR vs home em consultas de decisão (meta CTR ≥ 5% se posição ≤ 10) |
| `/programa-fundador` | Impressões + cliques (conversão) |
| `/conteudo/*` (artigos Fase 2) | Impressões por artigo; reforçar links internos se zero |

### Indexação prioritária

Se **Inspeção de URL** mostrar “URL não está no Google”, solicitar indexação:

1. `/por-que-axecloud`
2. `/conteudo/planilha-ou-software-quando-migrar-gestao-terreiro`
3. `/conteudo/como-instalar-axecloud-celular-pwa`
4. `/conteudo/whatsapp-oficial-vs-grupos-comunicacao-terreiro`
5. `/conteudo/melhor-software-terreiro-2026-o-que-avaliar`

Após cada deploy de conteúdo: **Indexação → Sitemaps → Reenviar** (ou aguardar crawl).

---

## 2. Google Business Profile (já configurado)

O perfil complementa o GSC: aparece em buscas de marca e pode gerar cliques diretos para o site.

### Métricas (Desempenho → últimos 28 dias)

| KPI | Onde | Meta 90 dias |
|-----|------|--------------|
| Visualizações do perfil | Desempenho → Visualizações | Tendência estável ou ↑ |
| Pesquisas no Google | Desempenho → Como encontraram → Pesquisa | Anotar termos (marca + produto) |
| Cliques no site | Desempenho → Cliques no site | ≥ 5/semana quando houver dados |
| Chamadas / mensagens | Desempenho | Registrar (SaaS: volume baixo é normal) |
| Publicações | Novidades no perfil | **1 post a cada 15 dias** |

### Boas práticas GBP + site

- **Site no perfil:** `https://axecloud.com.br` (mesmo domínio verificado no GSC).
- **Categoria:** Software / Serviços de tecnologia (ou equivalente).
- **Descrição:** mencionar gestão de terreiros, Umbanda, Candidomblé, trial 30 dias, PWA.
- **Posts:** linkar `/programa-fundador`, `/por-que-axecloud` ou artigo novo do hub.
- **JSON-LD:** opcional — defina `VITE_GOOGLE_BUSINESS_PROFILE_URL` no `.env` para incluir o perfil em `Organization.sameAs` (reforça ligação marca ↔ GBP).

---

## 3. Planilha semanal

Copie `docs/seo-kpi-snapshot.template.csv` para Google Sheets e preencha todo domingo.

Colunas principais: impressões/cliques/CTR/posição GSC + visualizações/cliques GBP + notas (ex.: “pedi indexação do comparativo”).

---

## 4. Quando agir

| Sinal | Ação |
|-------|------|
| URL nova sem indexação após 7 dias | Inspeção de URL → Solicitar indexação |
| Posição ≤ 10 mas CTR &lt; 2% | Revisar `<title>` e meta description |
| Zero impressões em termo genérico | Link interno da home, `/conteudo` e `/por-que-axecloud` |
| Queda súbita de impressões | Indexação → Páginas (erros?) + Core Web Vitals |
| GBP sem cliques no site | Post com CTA + conferir URL do site no perfil |

---

## 5. Calendário (primeiros 90 dias)

| Semana | Foco KPI |
|--------|----------|
| 1–2 | Baseline + sitemap OK + indexar `/por-que-axecloud` |
| 3–4 | Artigos Fase 2 indexados · impressões em “software terreiro” |
| 5–6 | CTR comparativo vs home · 1 post GBP |
| 7–8 | 25+ páginas indexadas (diretório `/terreiros`) |
| 9–12 | Top 5 em termo genérico · depoimentos na landing (E-E-A-T) |

---

*Atualizado: jun/2026 · axecloud.com.br*
