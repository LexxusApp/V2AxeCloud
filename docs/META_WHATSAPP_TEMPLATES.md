# Templates Meta WhatsApp — AxéCloud

Rascunhos para criar no **Meta Business Manager** → WhatsApp → Message templates.

- **Idioma:** Português (Brasil) — `pt_BR`
- **Categoria sugerida:** **Utilidade** (lembretes, confirmações, alertas operacionais)
- **Conta WABA:** `1035133915841971`
- **Após aprovação:** adicionar as variáveis `WA_META_TEMPLATE_*` no `.env` da VPS e reiniciar o app

Os nomes abaixo devem ser **idênticos** aos usados no código (`api/lib/whatsappMetaCloud.ts`).

---

## 1. `mensalidade_disponivel_axecloud`

**Uso:** cron diário no **dia 1** do mês (horário de Brasília). Avisa que a mensalidade da competência já está disponível para pagamento.

**Corpo:**

```
Olá, {{1}}! A mensalidade de {{2}} no valor de R$ {{3}} já está disponível para pagamento no {{4}}.

Sua contribuição fortalece a casa. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Maria Silva |
| {{2}} | agosto de 2026 |
| {{3}} | 150,00 |
| {{4}} | Terreiro de Oxum |

**Env:** `WA_META_TEMPLATE_MENSALIDADE_DISPONIVEL=mensalidade_disponivel_axecloud`

---

## 1b. `lembrete_mensalidade_pendente_axecloud`

**Uso:** cron **uma vez por semana** (dia estável por terreiro). Na **semana do vencimento**, dois dias aleatórios (nunca o dia do vencimento). Só se a mensalidade ainda estiver em aberto. Também no botão Lembrete do Financeiro.

**Corpo:**

```
Olá, {{1}}! Lembramos que sua mensalidade de {{2}} no valor de R$ {{3}} ainda está pendente no {{4}}.

Quando puder, regularize pelo portal da casa. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Maria Silva |
| {{2}} | 08/2026 (venc. 15/08/2026) |
| {{3}} | 150,00 |
| {{4}} | Terreiro de Oxum |

**Env:** `WA_META_TEMPLATE_MENSALIDADE_PENDENTE=lembrete_mensalidade_pendente_axecloud`

Até a aprovação na Meta, o lembrete cai no legado `financeiro_axecloud`.

---

## 1c. `mensalidade_vence_hoje_axecloud`

**Uso:** cron no **dia do vencimento** (horário de Brasília). Lembra que a mensalidade vence naquele dia.

**Corpo:**

```
Olá, {{1}}! Sua mensalidade de {{2}} no valor de R$ {{3}} vence hoje no {{4}}.

Quando puder, regularize pelo portal da casa. Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Maria Silva |
| {{2}} | agosto de 2026 |
| {{3}} | 150,00 |
| {{4}} | Terreiro de Oxum |

**Env:** `WA_META_TEMPLATE_MENSALIDADE_VENCE_HOJE=mensalidade_vence_hoje_axecloud`

A Meta recategorizou este modelo para **Marketing**. Continua ativo e usável; Utility ficam `mensalidade_disponivel_axecloud` e `lembrete_mensalidade_pendente_axecloud`.

---

## 1d. `financeiro_axecloud` (legado)

**Uso:** fallback do lembrete pendente enquanto `lembrete_mensalidade_pendente_axecloud` não estiver APPROVED.

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

## 3b. `conta_ativa_axecloud` (cadastro / Enviar acesso)

**Uso:** cadastro de filho + botão “Enviar acesso”.

**Categoria:** Utilidade

**Corpo (aprovável como Utilidade):**

```
Olá, {{1}}!

Você foi cadastrado(a) no AxéCloud do terreiro {{2}}.

Seu registro: {{3}}

Axé!
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Maria Silva |
| {{2}} | Terreiro de Oxum |
| {{3}} | AXC-2026-A1B2 |

**Botão URL (estático):** texto `Acessar o portal` → `https://axecloud.com.br/entrar?modo=filho`

O link abre direto o login do filho. A tela explica: **Registro + 6 primeiros dígitos do CPF**.

**Não colocar no template** texto tipo “senha/código/CPF para entrar” — a Meta classifica como Autenticação e rejeita em Utilidade (`INCORRECT_CATEGORY`).

**Env:** `WA_META_TEMPLATE_DADOS_ACESSO=acesso_membro_guia_axecloud` (preferido: registro + guia).  
Legado portal: `WA_META_TEMPLATE_DADOS_ACESSO=conta_ativa_axecloud`.

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
# Em produção usamos a variante Utility (sem header de imagem) para evitar o
# bloqueio #131049 aplicado a templates Marketing: aviso_gira_util_axecloud.
WA_META_TEMPLATE_AVISO_GIRA=aviso_gira_util_axecloud
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

**Atenção (bug comum na Meta):** a URL do botão **não** pode ficar
`https://axecloud.com.br/convite/%7B%7B1%7D%7D{{1}}` (isso vira `/convite/{{1}}` + token e quebra o RSVP).
Confira no WhatsApp Manager que a URL exibida é exatamente `https://axecloud.com.br/convite/{{1}}`
sem `{{1}}` duplicado/escaped. Se estiver errado, crie um template novo (a Meta costuma não deixar editar a URL).

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

## 7. `aviso_portal_conta_axecloud` (recomendado — transmissão / mural)

**Uso:** publicar aviso no Mural com WhatsApp + transmissão manual + teste.

**Categoria Meta:** Utility aprovado (ago/2026). O `aviso_portal_axecloud` original e o
`aviso_portal_util_axecloud` foram recategorizados como Marketing pela Meta (sofrem o
bloqueio #131049). O texto que passou como Utility é o de "aviso administrativo de conta":

```
Ola, {{1}}. Registramos uma atualizacao administrativa na sua conta de membro
do {{2}}. Os detalhes estao disponiveis na sua area do portal do filho de santo.
```

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
WA_META_TEMPLATE_TRANSMISSAO_AVISO=aviso_portal_conta_axecloud
WA_META_TEMPLATE_BROADCAST=aviso_portal_conta_axecloud
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

**Env:** `WA_META_TEMPLATE_PEDIDO_REZA_ACEITO_FIEL=pedido_reza_aceito_fiel_util_axecloud` (variante Utility aprovada; a original `pedido_reza_aceito_fiel_axecloud` ficou como Marketing)

**Disparo:** Atendimentos → aceitar pedido de reza → WhatsApp do fiel (telefone informado no pedido).

---

## 12. `acesso_evento_visitante_axecloud` (substitui `senha_evento_visitante`)

**Uso:** visitante solicita acesso no site do evento → recebe WhatsApp com nº de atendimento + link de check-in.  
No dia, na portaria: abre o link → câmera → aponta no **QR Code do tablet**.

**Categoria Meta:** Utilidade (confirmação de presença / ingresso do evento).

> **Por que o anterior foi rejeitado:** modelos de Utilidade com a palavra **“senha”** (e nomes tipo `senha_evento_*`) a Meta costuma rejeitar — isso fica reservado à categoria **Autenticação**. Crie um modelo **novo** (não reedite o rejeitado).

**Nome sugerido:** `acesso_evento_visitante_axecloud`

**Corpo (submeter assim):**

```
Olá, {{1}}! Seu número de atendimento para {{2}} no {{3}} é {{4}}. Data: {{5}}. Horário: {{6}}. No dia do evento, use o botão abaixo na portaria para confirmar sua presença.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Ana Souza |
| {{2}} | Gira de Caboclo |
| {{3}} | Terreiro de Oxum |
| {{4}} | 42 |
| {{5}} | 20/07/2026 |
| {{6}} | 19:00 |

**Botão (URL dinâmica):**

| Botão | Texto | URL base | Amostra |
|-------|-------|----------|---------|
| 1 | Confirmar presença | `https://axecloud.com.br/presenca/` | `abc123token` |

Na Meta: URL **Dinâmica** → `https://axecloud.com.br/presenca/{{1}}`  
Amostra: `abc123token` (só o token)

**Env:**

```env
WA_META_TEMPLATE_SENHA_EVENTO_VISITANTE=acesso_evento_visitante_axecloud
```

**Disparo:** página pública do evento → visitante solicita acesso com WhatsApp.

---

## 13. `recuperar_senha_axec` (Autenticação / OTP)

**Uso:** fluxo “Esqueceu sua senha?” do zelador (`/recuperar-senha`).

**Categoria Meta:** **Autenticação** (não Utilidade).

### O que marcar na tela “Configuração de entrega do código”

| Opção | Usar? | Por quê |
|-------|-------|---------|
| Preenchimento automático de zero toque | **Não** | Exige app Android + package + hash; recuperação é no site |
| Preenchimento automático de um toque | **Não** | Idem (deep link no app) |
| **Copiar código** | **Sim** | Usuário cola o código em `/recuperar-senha` |

Na seção **Conteúdo**:
- Marque **Adicionar recomendação de segurança** (já está ok)
- Opcional: **Adicione o tempo de expiração do código** → **10 minutos** (bate com o TTL do AxéCloud)

Não preencha “Nome do pacote” / “Hash de assinatura” — isso só vale para autofill no app.

**Nome sugerido do modelo:** `recuperar_senha_axec` (já aprovado na sua WABA).

**Env:**

```env
WA_META_TEMPLATE_FORGOT_PASSWORD=recuperar_senha_axec
```

O código envia o OTP no formato de autenticação Meta (corpo + botão Copiar código).  
**Fallback:** se o template ainda não estiver aprovado, empacota em `aviso_geral_axecloud`.

---

## Templates já existentes (referência)

| Nome | Variáveis |
|------|-----------|
| `aviso_geral_axecloud` | {{1}} membro · {{2}} sistema/terreiro (fallback + boas-vindas) |
| `acesso_evento_visitante_axecloud` | {{1}} visitante · {{2}} evento · {{3}} terreiro · {{4}} nº · {{5}} data · {{6}} hora + botão presença |
| `recuperar_senha_axec` | Autenticação OTP · botão Copiar código |
| `mural_aviso_axecloud` | {{1}} filho · {{2}} terreiro · {{3}} título |
| `aviso_gira_axecloud` | Header imagem · {{1}} título · {{2}} data · {{3}} hora |
| `convite_evento_axecloud` | Header imagem · 5 vars corpo · botões RSVP |

---

## Novos (04/08/2026) — onboarding / instruções

### `boas_vindas_zelador_axecloud` (Utilidade) — **APPROVED**

**Uso:** WhatsApp de boas-vindas ao cadastrar terreiro (zelador), com botão para `/instrucoes`.

**Status Meta:** APPROVED (id `1469762495172100`).

**Corpo:**

```
Axé, {{1}}! O terreiro {{2}} foi cadastrado no AxéCloud com sucesso. Entre no painel com o e-mail {{3}}. No botão abaixo você encontra as instruções de uso e como seus membros acessam o app.
```

| Variável | Exemplo |
|----------|---------|
| {{1}} | Alex |
| {{2}} | YLÊ EXU TIRIRI LONAN |
| {{3}} | sistemap514@gmail.com |

**Botão URL (fix):** `Instruções de uso` → `https://axecloud.com.br/instrucoes`

**Env:** `WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR=boas_vindas_zelador_axecloud`

---

### Membro / filho — **`acesso_membro_guia_axecloud` (APPROVED)**

Registro de acesso + botão do guia. Substitui o Marketing sem registro.

| Template | Status | O que entrega |
|----------|--------|----------------|
| `acesso_membro_guia_axecloud` | **APPROVED** Utility | Nome + terreiro + **registro** + botão `/instrucoes/membro` |
| `conta_ativa_axecloud` | APPROVED Utility | Nome + terreiro + **registro** + botão portal `/entrar?modo=filho` (legado) |
| `guia_membro_portal_axecloud` | APPROVED Marketing | ❌ Só guia, **sem registro** — não usar |

**Corpo (`acesso_membro_guia_axecloud`):**

```
Olá, {{1}}! Sua conta no AxéCloud do terreiro {{2}} está ativa. Seu registro de acesso é {{3}}. Use o botão abaixo para ver o guia de entrada no app.
```

**Env:**

```env
WA_META_TEMPLATE_DADOS_ACESSO=acesso_membro_guia_axecloud
WA_META_TEMPLATE_GUIA_MEMBRO=acesso_membro_guia_axecloud
```

**Tipos no código:** `dados_acesso` e `guia_membro`.
---

## Checklist pós-aprovação (VPS)

1. Editar `/opt/axecloud/.env` e adicionar:

```env
WA_META_TEMPLATE_MENSALIDADE_DISPONIVEL=mensalidade_disponivel_axecloud
WA_META_TEMPLATE_MENSALIDADE_PENDENTE=lembrete_mensalidade_pendente_axecloud
WA_META_TEMPLATE_MENSALIDADE_VENCE_HOJE=mensalidade_vence_hoje_axecloud
WA_META_TEMPLATE_FINANCEIRO=financeiro_axecloud
WA_META_TEMPLATE_COBRANCA_MENSALIDADE=cobranca_mensalidade_axecloud
WA_META_TEMPLATE_MENSALIDADE_CONFIRMADA=mensalidade_confirmada_axecloud
WA_META_TEMPLATE_AVISO_GIRA=aviso_gira_util_axecloud
WA_META_TEMPLATE_CONVITE_EVENTO=convite_evento_axecloud
WA_META_TEMPLATE_ESTOQUE_CRITICO=estoque_critico_axecloud
WA_META_TEMPLATE_TRANSMISSAO_AVISO=aviso_portal_conta_axecloud
WA_META_TEMPLATE_BROADCAST=aviso_portal_conta_axecloud
WA_META_TEMPLATE_PEDIDO_REZA_NOVO_ZELADOR=pedido_reza_novo_zelador_axecloud
WA_META_TEMPLATE_PEDIDO_REZA_ACEITO_FIEL=pedido_reza_aceito_fiel_util_axecloud
WA_META_TEMPLATE_SENHA_EVENTO_VISITANTE=acesso_evento_visitante_axecloud
WA_META_TEMPLATE_FORGOT_PASSWORD=recuperar_senha_axec
WA_META_TEMPLATE_BOAS_VINDAS_ZELADOR=boas_vindas_zelador_axecloud
WA_META_TEMPLATE_DADOS_ACESSO=acesso_membro_guia_axecloud
WA_META_TEMPLATE_GUIA_MEMBRO=acesso_membro_guia_axecloud
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
