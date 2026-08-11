# Automação comercial segura — Suzano

O job `growth-prospecting`, executado a cada cinco minutos, também coordena o funil seguro:

- uma seleção a partir das 09h (`morning`);
- uma seleção a partir das 14h (`afternoon`);
- pesquisa de e-mail, site, formulário e redes oficiais com Google Search grounding;
- envio do convite pelo e-mail comercial público quando localizado;
- link para o próprio terreiro iniciar a conversa no WhatsApp;
- vendedor de IA somente após uma mensagem inbound daquele prospecto;
- opt-out imediato para “pare”, “sair”, “não quero” e equivalentes.

Variáveis do servidor:

```env
GROWTH_SAFE_OUTREACH_ENABLED=false
GROWTH_SAFE_OUTREACH_TEST_MODE=true
GROWTH_AI_SALES_ENABLED=false
GROWTH_GEMINI_MODEL=gemini-2.5-flash
GROWTH_WHATSAPP_NUMBER=5511912276156
GROWTH_FROM_NAME=AxéCloud
GROWTH_REPLY_TO=axeagendado@gmail.com
```

Também são necessárias `GEMINI_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `APP_PUBLIC_URL`.

O sistema não tenta preencher formulários arbitrários automaticamente. Formulários têm campos, termos e proteções diferentes; quando só esse canal é encontrado, o candidato fica marcado como `manual_required` no painel. Ele também não envia WhatsApp para números do Google: o agente de IA é liberado quando o destinatário inicia a conversa pelo link recebido.

Ativação recomendada:

1. Aplicar a migration `20260811003000_growth_safe_outreach.sql`.
2. Definir `GROWTH_SAFE_OUTREACH_ENABLED=true`, manter `GROWTH_SAFE_OUTREACH_TEST_MODE=true` e executar o cron uma vez para validar até duas pesquisas sem envio.
3. Confirmar SMTP e número comercial.
4. Alterar `GROWTH_SAFE_OUTREACH_ENABLED=true` e `GROWTH_SAFE_OUTREACH_TEST_MODE=false`.
5. Ativar `GROWTH_AI_SALES_ENABLED=true` após um teste inbound no WhatsApp oficial.
