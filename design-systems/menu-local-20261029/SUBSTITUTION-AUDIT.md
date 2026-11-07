# Comparação antes da substituição

Data: 31/10/2026. Escopo: sistema existente no repositório, prévia local e identificação pública da versão publicada. Nenhuma alteração de produção ou de dados reais foi feita nesta auditoria.

## Parecer

**A prévia ainda não pode substituir diretamente a aplicação atual.** Ela cobre as 19 páginas principais da navegação da zeladoria e vários fluxos entre elas, mas continua sendo uma aplicação de demonstração. Aprovação visual e coerência dos dados locais não comprovam integração com o sistema real.

O caminho recomendado é incorporar o visual aprovado nos módulos existentes, conservando autenticação, serviços, dados, rotas públicas, portal do membro e regras de acesso. Não publicar o `dist` independente da prévia como substituto do aplicativo.

## Qual versão foi comparada

- Produção: GET público de `/dashboard` respondeu 200, com entrada `/assets/index-ObRXTday.js`.
- `/build-info.json` público informou `console-clean-1793139000953`, construção `2026-10-27T22:10:00.953Z`.
- Cópia de trabalho: HEAD `3bc0ed5`, com numerosas alterações locais preexistentes. `public/build-info.json` local informa `2f4e3a1-1793093639411`.
- Esses identificadores não estabelecem equivalência entre a cópia de trabalho e a versão implantada. O identificador público também não comprova qual revisão da API está publicada.
- Ao abrir `/dashboard` no navegador disponível, a produção redirecionou para `/entrar`. Não havia sessão autenticada utilizável para percorrer as telas privadas. Não foram procuradas credenciais nem feitas operações reais.
- Portanto, a matriz abaixo é uma comparação de **código e contratos existentes**, com disponibilidade pública conferida; não é certificação de execução de todos os fluxos em produção. A comparação autenticada final continua pendente.

## Bloqueios para trocar a aplicação

1. **Persistência e identidade.** `main.tsx:104–144` da prévia inicializa membros, cobranças, mensagens, arquivos e módulos com exemplos em `useState`. Recarregar reinicia os dados. Não há sessão, autorização por terreiro nem armazenamento real nessa entrada. As únicas gravações locais persistentes identificadas no shell são preferências de recolhimento do menu. No sistema existente, `src/App.tsx` hidrata sessão, papel e terreiro e aplica regras de acesso.
2. **Financeiro real e portal do filho.** Criar, receber e reabrir cobranças funcionam no estado da prévia, mas não atualizam o banco nem outro dispositivo. Falta consumir os serviços existentes e preservar o portal autenticado, a sincronização mensal e a revisão dos comprovantes.
3. **Recursos simplificados ou ausentes.** Preceito completo, convites/QR/portaria públicos das giras, gravação de áudio, credenciais da conta e alguns campos/ações dos formulários ainda não têm paridade.
4. **Serviços externos.** WhatsApp, notificações, uploads, publicação no Radar, suporte e assinatura são simulados ou locais. Indicador de sucesso só pode aparecer após a confirmação do serviço real.
5. **Dados e segurança do acervo privado.** A seleção de destinatários da biblioteca está no protótipo, mas o endpoint de leitura examinado lista materiais do terreiro sem filtro por destinatário. A função privada exige autorização no servidor para listagem, download e URLs assinadas; ocultar cartões na interface é insuficiente.

## Matriz por página e recurso

“Local” nesta tabela significa comportamento de demonstração; não significa gravação real.

| Área | Correspondência na prévia | Diferença que precisa ser resolvida | Fonte do sistema existente |
| --- | --- | --- | --- |
| Menu, cabeçalho e perfil | Um recolhimento, grupos Casa/Financeiro, conta/suporte, atalhos de perfil e navegação móvel | Conectar nome/foto/papel/assinatura da conta, logout real e permissões; manter rotas e navegação próprias do membro. Tradição local está fixa em `umbanda`. | `src/App.tsx:1259`, `src/components/app/AppTopNav.tsx:806`, `src/constants/appNav.ts:160` |
| Início | Indicadores, atenção, ativação e linha do tempo | Ainda há eventos, horários e números de exemplo. Radar mostra 84 visitas de exemplo; notificações e parte da linha do tempo são fixas. Usar dados reais ou estado vazio, nunca números de demonstração como fallback. | `src/views/Dashboard.tsx`, `src/hooks/useDashboardResources.ts`; local `DashboardPage.tsx:27`, `main.tsx:69` |
| Filhos de Santo e perfil | Cadastro, CPF/situação, anotações, obrigações e financeiro compartilhado localmente | Modelo local não inclui foto do membro; acesso é simulado, sem criação/vínculo de login ou envio individual/em massa de credenciais. Preservar IDs e vínculos reais. Aniversariantes locais filtram mês `10` fixo. | `src/views/Children.tsx:31`, `:250`, `:296`; `src/components/child-profile/ChildProfileEditModal.tsx`; local `MembersPage.tsx:15`, `:71` |
| Obrigações | Membro, título, data/hora, observações, PDF e lembrete | PDF em memória e preferência de lembrete não equivalem a upload, agendamento ou entrega. Preservar acesso e visualização no portal do filho. | `src/views/Obligations.tsx`, `src/components/child-profile/ObligationScheduleModal.tsx`, `src/views/ObrigacoesFilho.tsx` |
| Giras | Agenda, destaque, lembrete, vagas, participantes e senhas locais | Conservar banner do evento, notificações reais e operação com tokens/links públicos de convite, check-in, senhas e portaria. As simulações locais não substituem esses links. | `src/views/Calendar.tsx:854`, `:1217`; `src/lib/giraOperations.ts:98`, `:186`; `src/router/AppRouter.tsx:104` |
| Preceito | Ativar/encerrar associado a uma gira | Falta editor completo: título, motivo, início/fim, público corrente/cargo/individual, exclusões, orientações e acompanhamento de ciência/dispensa/orientação. | `src/components/preceito/PreceitoCommandCenter.tsx:37`, `:219`, `:267`; local `main.tsx:250` |
| Frequência | Chamada, justificativa, conclusão e histórico locais | Integrar participações reais e entradas por QR/aplicativo/portaria; confirmação de presença e comparecimento continuam conceitos distintos. | `src/views/Frequencia.tsx:118`, `src/lib/giraOperations.ts:145` |
| Comunicados | Categoria, expiração, texto e preferência de WhatsApp | Publicação e leitura pelo filho dependem do serviço real; preferência local não envia mensagem. | `src/views/NoticeBoard.tsx`, `src/components/filho/FilhoNoticeExperience.tsx` |
| Mensagens | Conversas, texto e anexo local | Falta gravação de áudio existente no atual e integrar entrega, upload, leitura e atualização em tempo real entre contas. Estado `local` não é confirmação de entrega. | `src/views/ChatInbox.tsx:39`, `:71`; `src/components/chat/ChatThread.tsx:278`, `:336`; `src/components/chat/ChatAudioRecorder.tsx:57` |
| Financeiro — visão geral | Entrada/saída, mensalidade manual, juros, caixa e exportação CSV locais | Usar registros/IDs reais e serviços existentes; conciliar datas, categorias e efeitos no caixa. Exportação CSV existe em ambos; não classificada como ausente. | `src/views/Financial.tsx:316`, `:740`, `:963`; `lib/manualFinance.ts`; local `FinancialOverview.tsx:62` |
| Mensalidades | Antigas com juros fixos/percentuais de aplicação única, vínculo por membro, baixa e reversão | Faltam geração/sincronização automática, preferência de cobrança ativa e revisão de comprovantes com aprovação/rejeição, alertas, protocolo e histórico. Preservar pausas de lembrete e proteção contra duplicação do backend. | `src/views/Financial.tsx:427`, `:858`, `:1311`; `src/components/financial/ReceiptReviewPanel.tsx`; `src/lib/receiptReviewClient.ts` |
| Cantina | Cardápio, avulso, consumo/quantidades, caderneta, limite, baixa e histórico locais | Integrar cardápio, consumos, recebimentos, reversões/cancelamentos e cobrança reais. O limite compartilhado com a Loja deve ser validado também pelo servidor. As categorias ao lado do botão foram retiradas por pedido do usuário, não por esquecimento. | `src/components/financial/CantinaView.tsx:179`, `:462`, `:515`, `:539`, `:564` |
| Configurações Pix | Tipo/chave, beneficiário, valor sugerido e vencimento | **Incompatibilidade concreta:** local permite dias 1–28; atual permite até 31. Preservar contas que usam 29/30/31 e a regra para meses curtos. Tipos locais `phone/random` precisam mapear para `celular/aleatoria`. Geração do Pix válido do membro e apresentação/impressão do terminal atual não estão implementadas integralmente no local. | `src/components/financial/SacredPixConfigView.tsx:69`, `:238`; `src/components/PixPaymentModal.tsx:93`; local `PixSettingsPage.tsx:8`, `:24` |
| Galeria | Álbuns e arquivos locais | Integrar upload e conclusão, exclusão, reações e visualização dos arquivos reais. URLs `blob:` locais não sobrevivem ao recarregamento nem são compartilháveis. | `src/views/Gallery.tsx:414`, `:464`, `:487`, `:662`; local `LocalAttachments.tsx:5` |
| Almoxarifado | Cadastro, movimentação, mínimo, histórico e compras locais | Integrar estoque real e consistência entre sessões; não substituir cadastro existente por itens de demonstração. | `src/views/Inventory.tsx:92`, `:119`, `:130` |
| Biblioteca | Acervo geral e extensão privada por filho, leitor PDF local | Integrar armazenamento e acesso autenticado. **Backend examinado ainda não implementa destinatários privados:** GET lista por terreiro e emite URLs; upload/conclusão recebem título/categoria/terreiro, sem público/destinatário. Verificar também o proxy e a rota legada ao implementar a privacidade. | `src/views/Library.tsx:233`, `:293`, `:321`; `api/index.ts:2337`, `:2409`, `:3099`, `:4865` |
| Loja | Produtos, pedidos, reserva, caderneta, recebimento, entrega e limite compartilhado locais | Integrar catálogo/fotos, estoque e ciclo de pedidos reais, incluindo Pix pendente e ações da reserva; conservar experiência de compra do filho. | `src/views/Store.tsx:128`, `:229`, `:309`, `:351`, `:372`; `src/components/filho/FilhoStoreExperience.tsx` |
| Radar | Endereço, redes, capa/retrato, rotina, galeria própria, publicações, serviços e prévia | Conectar perfil público real, upload, publicação/retirada, localização e métricas. Mapa esquemático e modal de prévia não substituem diretório público. | `src/views/Radar.tsx:65`, `src/components/settings/ClaimedDirectoryProfileSettings.tsx:117`, `src/components/settings/DirectoryPublicProfileSettings.tsx:90` |
| Configurações / acesso | Editor de perfil e preferências locais | Preservar alteração real de e-mail/senha, exclusão da conta, recuperação e logout. Reiniciar exemplos locais não equivale a excluir conta. | `src/components/settings/SettingsAccountCredentialsPanel.tsx:57`, `:97`; `src/views/Settings.tsx:138` |
| WhatsApp / histórico | Filtros, detalhes, sucessos e falhas de exemplo | Conectar configurações e logs reais, preservando distinção entre aceito pela Meta, entregue, lido, parcial e falha; datas e destinatários vindos do serviço. Não simular conexão nem reenvio como sucesso real. | `src/components/settings/SettingsWhatsAppPanel.tsx:175`, `src/views/WhatsAppConfig.tsx:186`, `:429`; local `main.tsx:238` |
| Notificações | Três exemplos, marcar lida e navegar | Preservar a caixa persistida por conta, exclusão/leitura, ordenação e fuso; a prévia reinicia e usa datas escritas no exemplo. | `src/components/NotificationPanel.tsx:630`, `src/hooks/useNotificationInbox.ts:17`, `src/lib/notificationInbox.ts:28`; local `main.tsx:69`, `:248` |
| Assinatura | Histórico e renovação de teste separados do caixa da casa | Usar plano/valores/situação reais, checkout e restrições atuais. Não permitir que “simular recebimento” libere assinatura no produto real. | `src/views/MinhaAssinatura.tsx`, `src/views/SubscriptionRenewCheckout.tsx:93`, `src/components/SubscriptionLock.tsx`; local `SubscriptionPage.tsx:17` |
| Suporte | Chamado com responsável, casa e contato locais | Entregar à API real, guardar protocolo e exibir somente acompanhamento que o serviço oferece. Ticket local não chega à equipe. | `src/views/Support.tsx:111`; local `SupportPage.tsx` |

## Rotas que a nova entrada não pode apagar

Além das páginas principais da zeladoria, o sistema tem:

- Login de zelador/membro, cadastro, recuperação e redefinição de senha, contratação e renovação.
- Portal autenticado do filho: perfil, obrigações, mensalidade/comprovantes/Pix, biblioteca, loja, comunicados, mensagens e calendário (`src/App.tsx:1259`). A “prévia do financeiro do membro” local não equivale a esse portal.
- `/consulente/…`, `/convite/…`, `/checkin/…`, `/checkin-portaria/…`, `/presenca/…`, `/senhas/…` e `/widget/…` (`src/router/AppRouter.tsx:104`).
- Diretório/perfil público e rotas de marketing, servidos separadamente conforme configuração atual.
- Rotas internas para gestão avançada e administração no código atual (`src/App.tsx:1285`, `:1375`). Precisam de decisão explícita de preservação e validação da disponibilidade na versão implantada; não presumir que todas estão expostas no menu de produção.

Não considerei “Caixinha” ou o módulo antigo de pedidos de reza como páginas ativas faltantes: `CAIXINHA_ENABLED = false` em `src/views/Financial.tsx:99` e `PEDIDOS_REZA_MODULE_ENABLED = false` em `src/lib/tradicaoModules.ts:6`. Sua presença no código não obriga a reativá-los.

## Paridade de modais e contratos

O inventário local contém **57 estruturas JSX em 22 arquivos** (`MODAL-INVENTORY.json`). Isso é inventário de fonte, não execução de 57 fluxos reais. A etapa anterior exercitou 14 famílias a 390 e 320 px; essa evidência não cobre respostas da API, autenticação ou todas as combinações condicionais.

Diferenças de informação já confirmadas nesta auditoria:

- Preceito: o modal local não transporta o formulário completo de ciclo/público/participantes.
- Pix: dias 29–31 e nomes de tipos de chave incompatíveis.
- Membro: foto e envio/vínculo real de acesso ausentes do modelo local.
- Gira: banner e links/tokens públicos não equivalem à operação local.
- Comprovante: falta o conjunto de revisão e decisão do zelador.
- Conta: alteração de credenciais/exclusão reais não equivalem às orientações/reinício locais.

Mapear explicitamente `memberId → filho_id`, valores em centavos → unidade monetária esperada pela API, `pending/paid → pendente/pago`, `none/fixed/percent → nenhum/valor/porcentagem` e datas de competência/vencimento/recebimento. Reutilizar contratos existentes, sem gravar IDs `local-*` ou transformar cobranças de demonstração em registros reais. A cobrança pendente não compõe receita; baixa e estorno devem atualizar uma única transação de origem.

## Feedback e responsividade

`LocalFeedback.tsx` chama uma atualização síncrona e termina após duas renderizações. Na integração, trocar por acompanhamento da operação assíncrona real: salvar, aguardar resposta, atualizar as telas relacionadas, informar conclusão ou erro recuperável. Bloquear duplo envio e conservar o formulário quando houver falha; não mostrar “salvo” antes da confirmação.

As verificações móveis anteriores pertencem à prévia. Depois de integrar, repetir em 320/390 px e desktop: menu/dock por papel, teclado aberto, formulários longos, anexos, notificações, financeiro e portal do filho. Também testar conexão lenta, falha, recarga e dois dispositivos. Não é possível concluir que o resultado integrado é responsivo apenas pelos testes do protótipo.

## Ordem de integração e critérios para liberar

1. Estabelecer a versão exata de produção e registrar a matriz autenticada zelador/membro antes de alterar a entrada. Preservar a recuperação da versão existente.
2. Incorporar menu/cabeçalho aprovados no shell atual, conservando sessão, papéis, rotas, assinatura, logout e comportamento do PWA. Não forçar logout por troca visual.
3. Integrar financeiro/mensalidades/comprovantes/Cantina/Loja/Pix aos serviços atuais. Validar lançamento antigo com juros, pendência fora do caixa, baixa única, estorno, compartilhamento de limite e visão do membro em outra sessão.
4. Completar diferenças dos formulários e integrar os demais módulos. Biblioteca privada exige contratos e autorização próprios antes de ser liberada.
5. Remover entradas de demonstração, números fixos, ferramentas de teste e confirmações simuladas da aplicação real. Falta de dado deve produzir estado vazio/erro, não exemplo.
6. Validar persistência após recarga, autorização entre duas casas e entre dois membros, arquivos privados, datas/fuso, estados de WhatsApp/notificações e mensagens entre contas.
7. Testar a aplicação integrada em ambiente de validação com dados de teste identificados, incluindo celular e desktop; comparar todas as ações/modalidades da matriz. Só então preparar a publicação e sua reversão.

**Situação final desta auditoria: substituição direta não liberada.** Visual aproveitável; integração funcional e comparação autenticada final pendentes. Nenhum deploy, envio de mensagem, mudança de permissão ou lançamento financeiro real foi executado.
