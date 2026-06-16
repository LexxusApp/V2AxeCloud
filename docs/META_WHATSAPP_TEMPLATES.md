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

## 4. `estoque_critico_axecloud`

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

## 5. `comunicado_terreiro_axecloud`

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

> **Legado:** o template acima inclui saudação e cabeçalho fixos. Para comunicados com **texto totalmente livre** (só assinatura automática), submeta o template `mensagem_livre_terreiro_axecloud` (seção 6) e configure `WA_META_TEMPLATE_MENSAGEM_LIVRE` ou `WA_META_TEMPLATE_BROADCAST=mensagem_livre_terreiro_axecloud`.

---

## 6. `mensagem_livre_terreiro_axecloud` (recomendado para transmissão)

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

O sistema tenta primeiro **texto livre** (quando o filho está na janela de 24h) e usa este template como fallback.

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
WA_META_TEMPLATE_ESTOQUE_CRITICO=estoque_critico_axecloud
WA_META_TEMPLATE_BROADCAST=comunicado_terreiro_axecloud
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
