# Biblioteca: entrega para revisão do principal

Implementado localmente; nenhuma migration aplicada, nenhum serviço publicado e nenhum teste em navegador executado.

## Arquivos

- `cloudflare/pilot-library.js`: POST `/api/pilot/library/revisions`, confirmação de capability, preparação/verificação do PDF, tentativas idempotentes, rejeição de revisão aposentada, paginação privada por UUID em páginas de 500 (testada com 1.001), download de revisão aposentada negado.
- `design-systems/menu-local-20261029/remote/library.ts`: envio de revisão com identificador preservado após resposta perdida, novo identificador se payload/arquivo/conta mudar, sem updates diretos de acesso.
- `design-systems/menu-local-20261029/remote/media.ts`: integração mínima no loader/writer da Biblioteca. Galeria e estoque preservados. Novas publicações para a casa usam o bucket privado depois da ativação. Antes disso, a criação privada existente permanece disponível.
- `design-systems/menu-local-20261029/library.ts`: política de edição tipada e capability opcional no estado.
- `design-systems/menu-local-20261029/LibraryPage.tsx`: mesma estrutura visual; controles indisponíveis bloqueados para legado/migration pendente, envio duplicado bloqueado, erro conserva formulário/seleção, confirmação de mudança de acesso informa que comentários antigos não serão transferidos.

## Migration proposta, ordem e contrato de segurança

`supabase/migrations/20261103130000_pilot_library_revisions.sql` depende de `20261102150000`, `153000`, `154000` e da função `piloto_validar_zelador` existente. Deve ser revisada junto da strengthening `20261103150000` de Copernicus, que executará depois desta. **Não ativar esta entrega sem o gate completo de revogação de e-mail/perfil no Worker e no banco.**

O Worker principal já encaminha `/api/pilot/library/*` para este módulo. Não alterei o Worker principal, configurações ou scripts de build. Não há segredo/binding novo.

O helper compartilhado `cloudflare/pilot-operation-access.js` fica com Copernicus. Aguardando contrato para integrar ou patch do principal no `pilot-library.js`. O gate atual por ID, herdado do módulo anterior, ainda não resolve sozinho a divergência de revogação identificada pela auditoria.

Contrato para a migration 15 complementar:

- `piloto_pode_ler_pdf(uuid)`: ramo de zeladoria hoje por `auth.uid()=tenant_id`, inclusive histórico; ramo de membro exige UUID auth piloto + child exato + `f.user_id=auth.uid()` + casa + ativo + revisão ativa + audiência `casa` ou destinatário exato.
- `piloto_revisar_pdf(uuid,uuid,uuid,text,text,text,text,text,integer)`: depende de `piloto_validar_zelador` e valida também o ID de zeladoria exato. `piloto_finalizar_pdf` legado permanece com o mesmo validador.
- `piloto_comentar_pdf(uuid,uuid,text)`: bloqueia a linha da versão com `FOR SHARE` antes de verificar acesso e proíbe comentário de membro em versão aposentada; chama `piloto_pode_ler_pdf`. A autoria de membro usa o child piloto, inclusive em materiais da casa.
- `piloto_biblioteca_revisoes_disponiveis()`: retorna 1 apenas aos dois auth IDs; complementar a revogação neste capability se desejado. Não concede leitura por si.
- `storage.objects`: mantém as políticas anteriores, acrescenta negação restritiva de UPDATE e política restritiva por operação. Somente download autenticado; upload/delete apenas para zeladoria. A migration 15 precisa restringir também as permissões antigas de owner nos guards do bucket, preservando a política por operação.

Cada edição, inclusive metadados, cria novo ID/caminho e nova conversa. O RPC bloqueia a versão anterior `FOR UPDATE`, valida o PDF já no bucket privado e, na mesma transação, aposenta a versão anterior e insere a nova. Índices únicos impedem dois sucessores e duas versões ativas da mesma raiz. Aposentadoria/inserção são revertidas juntas se a transação falhar. Upload prévio interrompido deixa somente objeto privado não publicado; não concede acesso a membros. Não há limpeza automática desses objetos órfãos.

O banco mantém conteúdo, destinatário e metadados de uma revisão imutáveis. Arquivos antigos permanecem privados; a zeladoria conserva histórico, membros perdem acesso autenticado à revisão aposentada. O proxy da API compartilhada continua lendo exclusivamente o bucket legado e não recebe referências aos objetos novos. Nenhum comentário é copiado à nova revisão.

## Operações de Storage e limites históricos

A migration exige que o bucket já esteja privado e que `storage.allow_only_operation` / `storage.allow_any_operation` existam. Bloqueia `object.sign`, `object.sign_many`, listagem/cópia e caminhos S3 nesse bucket, conservando download autenticado. Sem helper/runtime compatível, deve falhar e ser revisada; não introduz fallback permissivo. Referências oficiais: [helpers e operações](https://supabase.com/docs/guides/storage/schema/helper-functions), [nomes de operações](https://github.com/supabase/storage/blob/master/src/http/routes/operations.ts).

URLs assinadas eventualmente emitidas **antes** desta política não são retroativamente invalidadas por RLS. O fluxo existente não gera URLs assinadas para PDFs privados, mas não foi feita auditoria remota para afirmar que nunca existiram. Elas continuam restritas aos bytes da versão antiga; não dão acesso à nova versão ou aos comentários. Antes de prometer revogação de links históricos, é necessário conferir/remover esses objetos pelo Storage e validar expiração/cache. Arquivos já baixados também não podem ser recolhidos.

## Compatibilidade legada: bloqueio explícito e caminho de conversão

`legacyRevisionEditing:false`. Em arquivos de `biblioteca`/`biblioteca_estudos`, seguem permitidos título, descrição e categoria; trocar PDF/destinatário/escopo fica desabilitado e a camada de escrita rejeita antes de qualquer update ou upload. Novos materiais da casa nascem no armazenamento protegido, permitindo conversões futuras entre casa e individual por revisão.

Para converter um arquivo legado com proteção verificável, uma integração futura deve:

1. Ler e preservar o snapshot original; preparar novo objeto em caminho privado exclusivo, sem publicar metadados novos.
2. Retirar o objeto legado **pela API do Storage**, nunca apagando somente `storage.objects` em SQL. Confirmar que proxy legado, URL pública e URLs assinadas conhecidas não servem os bytes; considerar caches/expiração e outros registros que referenciem o mesmo caminho.
3. Sob lock e validação do snapshot, transacionar a retirada do registro legado e a publicação da nova revisão, sem transferir comentários. Registrar a operação para repetição após resposta perdida.

Banco e Storage não oferecem uma transação conjunta para esses passos. Retirar o objeto antes da confirmação do banco cria janela de indisponibilidade; fazer depois cria janela de vazamento. Por isso esse protocolo **não está habilitado nem é apresentado como troca atômica nesta entrega**. Exige decisão/revisão do principal sobre indisponibilidade controlada e links/cache históricos. A alteração isolada de visibilidade foi expressamente evitada.

## Validação

- `tests/pilotLibraryEdit.test.ts`: Worker com Storage/RPC simulados; troca de bytes e destinatário, promoção à casa, cabeçalho PDF e SHA-256 do original verificados, falha antes do commit, resposta perdida, colisão, edição obsoleta, capability ausente, ator membro, limite legado, 1.001 linhas e cursor repetido.
- `tests/pilotLibraryEditClient.test.ts`: cliente preserva identidade da tentativa, isola conta, envia substituição, writer real exige confirmação, guards da UI/migration.
- `tests/pilotLibraryEdit.validation.sql`: script transacional com rollback para revisar/executar após as migrations. Exercita RLS, versões e comentários, idempotência, rollback de falha, escopo casa restrito ao piloto, membro inativo, operações Storage proibidas, anonimato e imutabilidade. Usa fixtures de catálogo, sem arquivos reais. **Não executado remoto/localmente por falta de Postgres local e pela instrução de revisão prévia.**
- Tipos da UI e módulos alterados verificados sem erro, incluindo dependências. Rodada final focada em Biblioteca/Galeria/Estoque: **22/22**, sendo 10 testes novos de edição. Regressão inicial da Biblioteca/comentários: 8/8. Rodada ampliada anterior: 50/51; falha externa ao escopo no teste de chat (`Cannot find module './notices'`, import paralelo em `remote/communication.ts`).

O principal mantém os testes de UI e fará, após revisão, a validação HTTP real do Storage (download autenticado permitido, assinatura negada, revisão antiga/novo destinatário negados quando apropriado) e do gate de revogação. SQL com rollback não substitui esses testes HTTP.
