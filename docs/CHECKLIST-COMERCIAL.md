# Checklist Comercial — AxéCloud

Plano prático para sair de **zero cases visíveis** e competir com [Kanzuá](https://kanzua.com.br) e [OganPro](https://www.oganpro.com.br/) em **confiança e prova social** — sem precisar lançar o roadmap inteiro do portal de uma vez.

---

## Meta dos próximos 30 dias

| Métrica | Hoje | Meta 30 dias |
|---------|------|--------------|
| Casas fundadoras ativas (aceitas + usando) | 1 | 3–5 |
| Depoimentos publicados na landing | 0 | 3 |
| Contatos WhatsApp enviados | — | 20 |
| Conversas qualificadas | — | 8 |
| Onboardings concluídos | 1 | 3 |

---

## Semana 1 — Preparar a vitrine (você + sistema)

- [x] Casa fundadora **Kwe Nago Vodun Omin Odolá** com cidade **Suzano — SP** no banco
- [x] Seção **Casas fundadoras** na landing (`#portal-axe`) puxando dados reais da API
- [ ] Publicar **depoimento** da casa no admin (`depoimento_publicado = true`) para aparecer em Depoimentos
- [ ] Tirar 2–3 screenshots reais do painel dessa casa (com autorização)
- [ ] Configurar **Google Search Console** + enviar sitemap
- [ ] Rotina **KPIs SEO** (domingo, 10 min) — ver `docs/SEO-KPIS-SEARCH-CONSOLE.md` ou `npm run seo:kpi-checklist`
- [ ] Revisar bio do Instagram / WhatsApp com link `axecloud.com.br/programa-fundador`

---

## Semana 2 — Prospecção ativa (20 contatos)

### Perfil ideal da próxima casa

- Terreiro em atividade (Umbanda, Candomblé, Jurema, Vodun ou mista)
- Zelador(a) ou responsável administrativo com WhatsApp ativo
- Dor clara: planilha, grupo de WhatsApp bagunçado, mensalidade confusa
- Região piloto: **Grande São Paulo** (Suzano, Mogi, SP capital, ABC, etc.)

### Onde buscar

- [ ] Instagram: `#terreiro`, `#umbanda`, `#candomblé`, `#casadeaxe` + sua região
- [ ] Indicação da casa **Kwe Nago Vodun Omin Odolá** (pedir 2 nomes)
- [ ] Grupos de zeladores / federações locais (com respeito, sem spam)
- [ ] Contatos que já perguntaram sobre o sistema no passado

### Scripts WhatsApp

Ver **`docs/SCRIPT-WHATSAPP-PROSPECCAO.md`** — 9 mensagens prontas (frio, indicação, follow-up, objeções, fechamento e pedido de indicação para Suzano/Alto Tietê).

### Registrar cada contato

| Data | Casa | Cidade | Respondeu? | Demo? | Status |
|------|------|--------|------------|-------|--------|
| | | | | | |

Status sugeridos: `sem_resposta` · `interessado` · `demo_agendada` · `onboarding` · `fundador_ativo` · `recusou`

---

## Semana 3 — Onboarding das 2 próximas casas

Para cada casa que aceitar:

- [ ] Criar acesso no painel (ou vincular inscrição no admin)
- [ ] Marcar inscrição como **accepted** + `autoriza_perfil_publico`
- [ ] Configurar junto: financeiro, 3 filhos de santo, 1 evento no calendário
- [ ] Pedir depoimento em texto (3–5 linhas) + autorização de publicação
- [ ] Atualizar cidade/tradição corretas no cadastro fundador

---

## Semana 4 — Fechar o ciclo de prova social

- [ ] 3 casas aparecendo em **#portal-axe** na landing
- [ ] 2–3 depoimentos na seção **Depoimentos**
- [ ] 1 post no Instagram: “Primeiras casas fundadoras do AxéCloud”
- [ ] Pedir indexação no Search Console das páginas `/` e `/programa-fundador`
- [ ] Revisar: a landing responde “quem já usa?” em menos de 5 segundos?

---

## O que NÃO fazer agora (mesmo com concorrência)

- [ ] Lançar diretório vazio com dezenas de slots fake
- [ ] Copiar preço do Kanzuá antes de ter 3 cases
- [ ] Construir mapa nacional, API pública ou 50 artigos antes de 5 casas reais
- [ ] Remover Programa Fundador e ir só para trial 14 dias (pode adicionar depois, em paralelo)

---

## Diferencial a repetir em toda conversa

> **Kanzuá e OganPro organizam a casa. O AxéCloud organiza e vai te colocar no portal público do axé no Brasil.**

Hoje a prova é: **casas fundadoras reais, com nome e cidade, no site.**

---

## KPIs semanais (5 minutos todo domingo)

### Comercial (WhatsApp / fundadores)

1. Quantas casas **accepted** no admin?
2. Quantas aparecem em `/api/v1/landing/founder-houses`?
3. Quantos depoimentos publicados?
4. Quantos leads novos no WhatsApp?
5. Alguém pediu demo depois de ver a seção **Casas**?

### SEO (Search Console + Google Business Profile)

Ver checklist completo: **`docs/SEO-KPIS-SEARCH-CONSOLE.md`** · terminal: `npm run seo:kpi-checklist` · planilha: `docs/seo-kpi-snapshot.template.csv`

Resumo:
1. GSC Performance (28d): impressões, cliques, CTR, posição média
2. GSC Indexação: páginas indexadas (meta **25+** em 90 dias)
3. Consultas: marca · genérico (`software terreiro`) · comparativo
4. Páginas: `/` vs `/por-que-axecloud` (CTR)
5. GBP: visualizações, cliques no site, 1 post quinzenal

---

## Próximo passo técnico (quando tiver 3 casas)

- Perfil público com link próprio (`/terreiros/{slug}`)
- Eventos públicos do calendário
- Página `/terreiros/suzano-sp` (SEO local)

Isso está no PDF `docs/AxeCloud-Roadmap-Portal-2026.pdf` — fase T1, não T1–T6 de uma vez.

---

*Atualizado: junho/2026 · axecloud.com.br*
