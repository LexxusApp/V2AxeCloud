# Refino do acesso delegado — 9 de novembro de 2026

## Estado da entrega

As correções estão no workspace. Os painéis foram compilados e os testes locais passaram. **A migration final não foi aplicada e estas alterações não foram publicadas em produção.** A validação remota ampliada foi bloqueada pela revisão automática de aprovação, conforme explicado abaixo.

O repositório já continha várias alterações de outras funcionalidades. Nenhum commit ou push foi feito neste trabalho. A versão global do sistema não foi incrementada e não foi introduzido logout em massa.

## Comportamento implementado

- O titular escolhe **Visualizar** ou **Gerenciar** por módulo no modal de co-admin. A concessão valida o vínculo ativo do membro com a casa; somente o titular altera os acessos.
- O membro conserva sua identidade e seu espaço pessoal. **Gestão da Casa** abre explicitamente o contexto de gestão da casa autorizada, sem transformá-lo no proprietário.
- A navegação e a página inicial de gestão apresentam somente os módulos liberados. A renovação da sessão mantém o contexto de gestão e atualiza as permissões ao retornar à janela e periodicamente.
- A autorização da API consulta a concessão atual, o vínculo do membro e a casa. Revogação, membro inativo, casa suspensa, permissões ausentes, parâmetros de outra casa e ações exclusivas do titular são recusados no servidor.
- Os caminhos de gestão deixam de depender da casa e da conta de teste anteriormente fixadas no código.
- Cantina e Loja têm consultas próprias para os dados financeiros necessários ao seu funcionamento. Liberar esses módulos não exige liberar a tela Financeiro. Referências de membros e giras também são limitadas ao necessário.
- Giras usam a assinatura da casa; Financeiro distingue a consulta pessoal da consulta de gestão. Biblioteca, revisões de PDF, Radar, estoque e mensagens usam a casa autorizada e mantêm a identificação do usuário que executou a ação.
- O modal, a entrada Gestão da Casa e a página inicial delegada foram refinados para celular, teclado e estados de salvamento/erro. O modo de leitura apresenta aviso e desabilita as principais ações de alteração; a API e o banco continuam responsáveis pela autorização efetiva.

## Arquivos centrais

- `api/lib/delegatedAccess.ts` e `api/lib/delegatedMiddleware.ts`: autorização compartilhada da API Express e da entrada Cloudflare.
- `cloudflare/pilot-granular-policy.js`, `pilot-operation-access.js`, `pilot-interface-worker.js` e `api-container-worker.ts`: classificação por módulo, seleção do painel e aplicação das permissões na borda.
- `design-systems/member-pilot-20261102/ManagementAccess.tsx` e `session.ts`: entrada de gestão e preservação da sessão pessoal.
- `design-systems/menu-local-20261029/CoAdminPermissions.tsx`, `DelegatedDashboard.tsx`, `coadmin-permissions.css` e `remote/`: concessão, navegação e carregamento restrito por módulo.
- `supabase/migrations/20261109120000_delegated_access_refinement.sql`: regras RLS/RPC para casas reais, consultas limitadas, auditoria e biblioteca privada. **Pendente de aplicação.**
- `tests/delegatedAccess.validation.sql`: cenário ampliado proposto para o banco. **A versão final deste cenário não foi executada.**

## Evidências de validação

Os logs e as capturas estão em `artifacts/coadmin-refinement/` (artefatos locais, fora do versionamento).

| Verificação | Resultado |
| --- | --- |
| Suíte principal de permissões, sessão, módulos e regressões | 270 testes passaram; zero falhas (`release-tests.log`) |
| Confirmação final de autorização, giras e contratos de segurança | 25 testes passaram; zero falhas (`final-security-confirmation.log`) |
| Testes adicionais de isolamento dos módulos | 28 testes passaram; zero falhas (`module-isolation-final.log`) |
| Cantina e Loja independentes | 20 testes passaram; zero falhas (`standalone-modules.log`) |
| Builds dos painéis de gestão e membro | Concluídos (`build-final.log`) |
| Build do aplicativo principal | Concluído (`legacy-final.log`, `legacy-result.json`) |
| Bundle do Worker de API | Concluído (`worker-build.log`) |
| TypeScript de release | Aprovado, sem erros (`checks-result.json`, `final-typecheck.log`) |
| Limites de arquitetura | Aprovados (`final-architecture.log`) |

As suítes têm cenários sobrepostos; os números acima não devem ser somados como testes únicos. A confirmação final também inclui os contratos de segurança do webhook WhatsApp, após remover uma declaração duplicada que impedia a checagem de tipos.

A verificação visual usou os componentes reais em uma página local de ensaio, com sessão e chamadas de rede simuladas. Foram avaliadas as larguras de 1440, 390 e 320 pixels e a orientação horizontal de 844 × 390: nenhum erro de página ou transbordamento horizontal, alvos de toque de pelo menos 44 pixels, fechamento por Escape com restauração do foco e recuperação após erro de salvamento. Evidência em `ui-results.json` e `permissions-*.png`. Não houve teste em aparelhos físicos ou Safari.

Uma versão anterior e mais restrita da migration e dos cenários SQL passou em dois ensaios transacionais com rollback no banco vinculado. Esses ensaios cobriram a matriz dos dez módulos, leitura/escrita, revogação, membro inativo, tentativa de elevar o próprio acesso e isolamento de casa. As consultas posteriores confirmaram ausência de concessões ativas duplicadas por conta/casa. **Isso não substitui a validação da versão final**, que inclui as consultas independentes de Cantina/Loja e cenários ampliados de biblioteca, estoque e outra casa.

Nenhuma mensagem real de WhatsApp ou push foi enviada pelos testes locais.

## Pendência remota e sequência de conclusão

A revisão automática rejeitou o ensaio que combinava DDL remoto, gravações de teste entre casas e operações de Biblioteca/PDF/Radar. O motivo informado foi a possibilidade de efeitos externos em armazenamento ou outras integrações não serem desfeitos por rollback. O comando recusado não foi repetido nem contornado.

Após autorização explícita para essa validação:

1. Conferir novamente o schema e o histórico do Supabase vinculado. Foram encontradas funções já instaladas cujas migrations de 7 de novembro não constam integralmente no histórico; não reaplicar essas migrations indiscriminadamente.
2. Concluir a validação da migration final e os cenários de leitura/escrita, isolamento, revogação e biblioteca com dados de teste identificáveis e limpeza dos efeitos externos que forem necessários. Não alterar concessões reais para completar o ensaio.
3. Aplicar a migration revisada pelo CLI Supabase e alinhar o histórico de migrations com o schema verificado. Publicar os artefatos pelos Workers Cloudflare configurados.
4. Confirmar as rotas oficiais e o runtime `cloudflare-container`. Fazer o teste integrado de titular → concessão → membro → Gestão da Casa → retorno ao espaço pessoal → revogação, conferindo cada módulo e o modo Visualizar.

Até concluir essa sequência, não há evidência suficiente para declarar o fluxo corrigido em produção ou prometer ausência total de erros.
