# axecloud-prospect-api (Cloudflare Worker)

Worker nativo da Cloudflare responsável pelo módulo de **Prospecção IA, CRM, Workflows e WhatsApp** do AxéCloud.

## Recursos Integrados
- **Cloudflare Workflows:**
  - `ProspectingDiscoveryWorkflow`: busca e deduplicação durável de terreiros candidatos.
  - `ProspectingLeadWorkflow`: ciclo individual de enriquecimento e qualificação por lead.
- **Cloudflare Queues:**
  - `prospecting-enrichment`
  - `prospecting-ai-analysis`
  - `prospecting-conversation`
  - `prospecting-dlq`
- **Cloudflare Crons:** `0 */4 * * *` (descoberta automática a cada 4 horas).
- **IA (Gemini):** Análise e scoring de terreiros candidatos + Agente Comercial de acolhimento.
- **WhatsApp Webhook:** Validação e recepção de mensagens inbound via Meta Cloud API com assinatura HMAC SHA-256.

## Endpoints Principais

### Rotas Públicas:
- `GET /api/prospecting/health`: Healthcheck do serviço.
- `GET /api/prospecting/webhook/whatsapp`: Validação do desafio do webhook da Meta (`hub.challenge`).
- `POST /api/prospecting/webhook/whatsapp`: Recepção das mensagens enviadas pelos terreiros.

### Rotas Protegidas (Requer JWT do Supabase):
- `GET /api/prospecting/dashboard`: Métricas do funil, contagens por status e evolução de 30 dias.
- `GET /api/prospecting/leads`: Listagem paginada com busca e filtros múltiplos.
- `POST /api/prospecting/leads`: Cadastro manual de novo lead.
- `GET /api/prospecting/leads/:id`: Dados completos, histórico e conversas do lead.
- `PATCH /api/prospecting/leads/:id`: Atualização de informações do lead.
- `POST /api/prospecting/leads/:id/analyze`: Solicita nova análise e scoring à IA.
- `POST /api/prospecting/leads/:id/qualify`: Qualificação manual do lead.
- `POST /api/prospecting/leads/:id/blacklist`: Inclusão na blacklist LGPD e encerramento de contatos.
- `POST /api/prospecting/discovery/run`: Dispara o Workflow de descoberta em background.
- `GET /api/prospecting/providers`: Lista de provedores de dados configurados.

## Comandos

```bash
# Validar tipagem TypeScript
npm run lint --prefix cloudflare/prospect-worker

# Executar testes unitários
npm run test:prospecting

# Deploy na Cloudflare
npm run deploy:prospecting:cloudflare
```
