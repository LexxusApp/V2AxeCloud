# Templates Meta WhatsApp — AxéCloud

Rascunhos para criar no **Meta Business Manager** → WhatsApp → Message templates.

- **Idioma:** Português (Brasil) — `pt_BR`
- **Categoria sugerida:** **Utilidade** (lembretes, confirmações, alertas operacionais)
- **Conta WABA:** `1035133915841971`
- **Após aprovação:** adicionar as variáveis `WA_META_TEMPLATE_*` no `.env` da VPS e reiniciar o app

Os nomes abaixo devem ser **idênticos** aos usados no código (`api/lib/whatsappMetaCloud.ts`).

---

## 1. `financeiro_axecloud`

**Uso:** cron diário (3 dias antes e no vencimento) + botão de lembrete no Financeiro.

**Corpo:**

```
Olá, {{1}}! Lembramos do pagamento da sua mensalidade no valor de R$ {{2}}, com vencimento em {{3}}, para o terreiro {{4}}.

Sua contribuição é fundamental para o nosso fundamento. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Maria Silva |
| {{2}} | 150,00 |
| {{3}} | 10/06/2026 |
| {{4}} | Terreiro de Oxum |

**Env:** `WA_META_TEMPLATE_FINANCEIRO=financeiro_axecloud`

---

## 2. `cobranca_mensalidade_axecloud`

**Uso:** botão “Gerar cobrança” no painel Financeiro.

**Corpo:**

```
Olá, {{1}}! Passando para lembrar da sua mensalidade de {{2}} no valor de R$ {{3}} no {{4}}.

Sua contribuição é fundamental para o nosso fundamento. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | João Santos |
| {{2}} | 06/2026 |
| {{3}} | 150,00 |
| {{4}} | Casa de Umbanda Axé |

**Env:** `WA_META_TEMPLATE_COBRANCA_MENSALIDADE=cobranca_mensalidade_axecloud`

---

## 3. `mensalidade_confirmada_axecloud`

**Uso:** após confirmar pagamento (`POST /api/confirm-mensalidade`).

**Corpo:**

```
Olá, {{1}}! Confirmamos o recebimento da sua mensalidade de {{2}} no valor de R$ {{3}} no {{4}}.

Obrigado pela contribuição. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Ana Costa |
| {{2}} | 06/2026 |
| {{3}} | 150,00 |
| {{4}} | Terreiro de Ogum |

**Env:** `WA_META_TEMPLATE_MENSALIDADE_CONFIRMADA=mensalidade_confirmada_axecloud`

---

## 4. `aviso_gira_axecloud`

**Uso:** ao criar evento/gira no Calendário com WhatsApp habilitado — avisa todos os filhos da corrente.

**Categoria Meta:** Utilidade (lembrete de evento / atualização de agenda).

**Header:** Imagem (banner do evento; se o evento não tiver banner, o sistema usa `WA_META_EVENT_DEFAULT_BANNER_URL`).

**Corpo:**

```
Novo evento no calendário do terreiro:

{{1}}

Data: {{2}}
Horário: {{3}}

Consulte o AxéCloud para mais detalhes.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Gira de Caboclo |
| {{2}} | 15/07/2026 |
| {{3}} | 20:00 |

**Header (amostra na submissão):** use qualquer imagem quadrada/horizontal do terreiro ou o banner padrão `https://axecloud.com.br/og-image.png`.

**Env:**

```env
WA_META_TEMPLATE_AVISO_GIRA=aviso_gira_axecloud
WA_META_EVENT_DEFAULT_BANNER_URL=https://axecloud.com.br/og-image.png
```

**Disparo:** Calendário → novo evento com opção WhatsApp → `dispatchGiraWhatsApp` envia para filhos ativos com telefone.

---

## 5. `convite_evento_axecloud`

**Uso:** convite WhatsApp para **convidados externos** (Calendário → Convidados → telefone).

**Categoria Meta:** **Marketing** (convite / divulgação — aceite a sugestão da Meta, não force Utilidade).

**Header:** Imagem (banner do evento ou `WA_META_EVENT_DEFAULT_BANNER_URL`).

**Corpo:**

```
Você foi convidado(a) pelo terreiro {{1}}!

Evento: {{2}}
Data: {{3}}
Horário: {{4}}
Local: {{5}}

Confirme sua presença pelos botões abaixo.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Terreiro de Oxum |
| {{2}} | Festa de Oxum 2026 |
| {{3}} | 20/07/2026 |
| {{4}} | 19:00 |
| {{5}} | Rua das Flores, 123 |

**Botões (tipo URL — dinâmico):**

| Botão | Texto do botão | URL base (fixa) | Sufixo dinâmico (exemplo) |
|-------|----------------|-----------------|---------------------------|
| 1 | Confirmar presença | `https://axecloud.com.br/convite/` | `abc123token/confirmar` |
| 2 | Não poderei ir | `https://axecloud.com.br/convite/` | `abc123token/declinar` |

Na Meta, ao criar cada botão URL dinâmico, a URL fica:

`https://axecloud.com.br/convite/{{1}}`

O sufixo `{{1}}` de cada botão é **independente** do corpo — use os exemplos acima na submissão.

**Env:**

```env
WA_META_TEMPLATE_CONVITE_EVENTO=convite_evento_axecloud
WA_META_EVENT_DEFAULT_BANNER_URL=https://axecloud.com.br/og-image.png
```

**Disparo:** Calendário → Convidados externos → adicionar nome + WhatsApp (plano Premium).

---

## 6. `estoque_critico_axecloud`

**Uso:** cron diário 09:00 → WhatsApp do zelador quando item ≤ mínimo.

**Corpo:**

```
⚠️ Alerta de estoque

O item *{{1}}* atingiu o nível crítico no {{3}}.
Quantidade atual: {{2}}

Por favor, providencie a reposição conforme necessário.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Vela branca 7 dias |
| {{2}} | 2 |
| {{3}} | Terreiro de Xangô |

**Env:** `WA_META_TEMPLATE_ESTOQUE_CRITICO=estoque_critico_axecloud`

---

## 7. `aviso_portal_axecloud` (recomendado — transmissão / mural)

**Uso:** publicar aviso no Mural com WhatsApp + transmissão manual + teste.

**Categoria Meta:** Utilidade (atualização de conta / portal).

**Fluxo:** igual ao `conta_ativa_axecloud` — template curto abre a janela de 24h → mensagem de texto livre com título + conteúdo + assinatura.

**Corpo:**

```
Olá, {{1}}!

Nova publicação no portal do terreiro {{2}}.

Consulte os detalhes na sequência.

AxéCloud
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Maria Silva |
| {{2}} | Terreiro de Oxum |

**2ª mensagem (texto livre, automática):**

```
*Reunião de corrente*

Salve a corrente! Hoje nossa gira inicia às 20h…

— Zelador · Terreiro de Oxum
```

**Env:**

```env
WA_META_TEMPLATE_TRANSMISSAO_AVISO=aviso_portal_axecloud
WA_META_TEMPLATE_BROADCAST=aviso_portal_axecloud
```

---

## 8. `comunicado_terreiro_axecloud` (legado — rejeitado na Meta)

**Uso:** transmissão manual (Configurações → WhatsApp) + mensagem de teste.

**Corpo:**

```
Paz e Luz, {{1}}!

Comunicado do terreiro {{2}}:

{{3}}

Acesse o AxéCloud para mais detalhes. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Pedro Lima |
| {{2}} | Terreiro de Iemanjá |
| {{3}} | Salve a corrente! Hoje nossa gira inicia às 20h. Contamos com todos na curimba. |

> A variável {{3}} aceita até ~1024 caracteres no envio; evite textos muito longos na transmissão.

**Env:** `WA_META_TEMPLATE_BROADCAST=comunicado_terreiro_axecloud`

> **Legado:** rejeitado (Marketing / muitas variáveis). Use `aviso_portal_axecloud` (seção 5).

---

## 9. `mensagem_livre_terreiro_axecloud` (legado — rejeitado na Meta)

**Uso:** transmissão manual — o zelador digita livremente; o sistema monta o corpo com assinatura da casa.

**Corpo (única variável):**

```
{{1}}
```

**Exemplo de {{1}} (preenchido pelo AxéCloud):**

```
Salve a Corrente! Hoje nossa sessão inicia às 20:00 com passe e descarrego. Aguardamos todos na curimba!

— Mirian · Kwe Nago Vodun Omin Odolá
```

| Variável | Conteúdo |
|----------|----------|
| {{1}} | Texto digitado pelo zelador + assinatura automática (`— Nome do zelador · Nome do terreiro`) |

**Env (após aprovação):**

```env
WA_META_TEMPLATE_MENSAGEM_LIVRE=mensagem_livre_terreiro_axecloud
# ou substitua o broadcast:
WA_META_TEMPLATE_BROADCAST=mensagem_livre_terreiro_axecloud
```

> **Legado:** rejeitado (variável no início/fim). Use `aviso_portal_axecloud` (seção 5).

---

## 10. `pedido_reza_novo_zelador_axecloud`

**Uso:** quando um fiel envia pedido pelo Espaço do Fiel (`POST /api/v1/public/consulente/:slug/pedidos-reza`).

**Corpo:**

```
Novo pedido de reza no {{1}}: {{2}} — {{3}}. Acesse Atendimentos no AxéCloud para aceitar o pedido.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Terreiro de Oxum |
| {{2}} | Maria Silva |
| {{3}} | Saúde / Cura |

**Env:** `WA_META_TEMPLATE_PEDIDO_REZA_NOVO_ZELADOR=pedido_reza_novo_zelador_axecloud`

---

## 11. `pedido_reza_aceito_fiel_axecloud`

**Uso:** quando o zelador aceita o pedido (`PATCH` status `aceito`).

**Categoria Meta:** Utilidade (confirmação de solicitação / status do pedido).

**Corpo:**

```
Olá, {{1}}! O zelador de {{2}} aceitou seu pedido. Sua reza será realizada na próxima gira. AxéCloud
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | João Santos |
| {{2}} | Casa de Umbanda Axé |

**Env:** `WA_META_TEMPLATE_PEDIDO_REZA_ACEITO_FIEL=pedido_reza_aceito_fiel_axecloud`

**Disparo:** Atendimentos → aceitar pedido de reza → WhatsApp do fiel (telefone informado no pedido).

---

## 12. `senha_evento_visitante_axecloud`

**Uso:** visitante solicita senha no site do evento → recebe WhatsApp com dados + link.  
No dia, na portaria: abre o link → câmera do celular → aponta no **QR Code do tablet** → presença confirmada automaticamente.

**Categoria Meta:** Utilidade (código de acesso / check-in).

**Corpo:**

```
Olá, {{1}}!

Sua senha para {{2}} no {{3}} é: {{4}}.

Data: {{5}}
Horário: {{6}}

No dia do evento, na portaria, abra o link abaixo. A camera do celular vai abrir para voce apontar no QR Code do tablet e confirmar sua presença.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Ana Souza |
| {{2}} | Gira de Caboclo |
| {{3}} | Terreiro de Oxum |
| {{4}} | 42 |
| {{5}} | 20/07/2026 |
| {{6}} | 19:00 |

**Botão (tipo URL — dinâmico):**

| Botão | Texto | URL base | Amostra do sufixo |
|-------|-------|----------|-------------------|
| 1 | Abrir check-in | `https://axecloud.com.br/presenca/` | `abc123token` |

Na Meta: Tipo de URL **Dinâmica** → `https://axecloud.com.br/presenca/{{1}}`  
Amostra: `abc123token` (só o token, sem `https://`)

> **Importante:** o botão **não** confirma presença sozinho. Ele abre `/presenca/{token}`, que liga a câmera para ler o QR da portaria (`/checkin-portaria/...` no tablet).

**Env:**

```env
WA_META_TEMPLATE_SENHA_EVENTO_VISITANTE=senha_evento_visitante_axecloud
```

**Disparo:** página pública do evento → visitante solicita senha com WhatsApp.

---

## Templates já existentes (referência)

| Nome | Variáveis |
|------|-----------|
| `aviso_geral_axecloud` | {{1}} membro · {{2}} sistema/terreiro (fallback + boas-vindas) |
| `mural_aviso_axecloud` | {{1}} filho · {{2}} terreiro · {{3}} título |
| `aviso_gira_axecloud` | Header imagem · {{1}} título · {{2}} data · {{3}} hora |
| `convite_evento_axecloud` | Header imagem · 5 vars corpo · botões RSVP |

---

## Checklist pós-aprovação (VPS)

1. Editar `/opt/axecloud/.env` e adicionar:

```env
WA_META_TEMPLATE_FINANCEIRO=financeiro_axecloud
WA_META_TEMPLATE_COBRANCA_MENSALIDADE=cobranca_mensalidade_axecloud
WA_META_TEMPLATE_MENSALIDADE_CONFIRMADA=mensalidade_confirmada_axecloud
WA_META_TEMPLATE_AVISO_GIRA=aviso_gira_axecloud
WA_META_TEMPLATE_CONVITE_EVENTO=convite_evento_axecloud
WA_META_TEMPLATE_ESTOQUE_CRITICO=estoque_critico_axecloud
WA_META_TEMPLATE_TRANSMISSAO_AVISO=aviso_portal_axecloud
WA_META_TEMPLATE_BROADCAST=aviso_portal_axecloud
WA_META_TEMPLATE_PEDIDO_REZA_NOVO_ZELADOR=pedido_reza_novo_zelador_axecloud
WA_META_TEMPLATE_PEDIDO_REZA_ACEITO_FIEL=pedido_reza_aceito_fiel_axecloud
WA_META_TEMPLATE_SENHA_EVENTO_VISITANTE=senha_evento_visitante_axecloud
```

2. `git pull` + rebuild/restart do container app.

3. Testar em Configurações → WhatsApp → envio de teste (usa `comunicado_terreiro_axecloud`).

4. Opcional: disparar cobrança manual em um filho de teste após aprovação de `cobranca_mensalidade_axecloud`.

---

## Dicas de aprovação na Meta

- Use categoria **Utilidade**, não Marketing, para lembretes e confirmações.
- Evite linguagem promocional agressiva nos templates financeiros.
- Preencha **exemplos** em todas as variáveis ao submeter.
- Se `estoque_critico_axecloud` for rejeitado por formatação (`*negrito*`), remova os asteriscos e reenvie — o código envia texto simples nas variáveis.
