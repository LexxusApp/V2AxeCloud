# Biblioteca de Estudos e acervo individual — prévia local

Etapa de 30/10/2026. Pedido: continuar a Biblioteca com local para o zelador adicionar PDF privado somente para um filho específico. Escopo exclusivamente nesta pasta, rota local #library. Sem produção, migração, banco, autenticação ou upload externo.

## Organização e visibilidade

Acervo da casa separado de Acervo privado; índice de assuntos, capas tipográficas de identificação, busca e ordenação. Verde/Inter herdados, papel em cores por categoria e lilás para a configuração individual. Capas não são miniaturas reais do PDF. PDFs sintéticos próprios descritos em assets/library/ASSETS.md.

Novos cadastros começam individuais em todos os pontos de entrada e exigem destinatário. Visibilidade individual modelada por ID estável, nunca por nome. Na prévia de membro, listas, contagens, assuntos, busca, detalhe, leitor e download usam o conjunto permitido. Alterar um PDF privado para toda a casa ou transferir para outro filho abre confirmação Antes/Depois. Cancelar restaura a edição, sem alterar o registro salvo.

## Cenários exercitados pela interface

- Adicionar material iniciou Privado para um filho. Título preenchido sem destinatário foi recusado antes de salvar.
- Seleção nativa de leitura-individual.pdf (arquivo sintético de 3032 bytes desta pasta) funcionou. Título “Leitura exclusiva para Mariana”, destinatária demo-1 e descrição foram salvos como File em memória.
- Mariana viu os três materiais comuns e dois individuais (o original e o novo). O PDF local foi aberto no leitor, com Página 1 de 2. Joana viu somente seu material individual; o botão do novo PDF de Mariana não existia na sua coleção. André viu vazio em Só para mim.
- Editar o PDF privado para Acervo da casa mostrou Antes Privado/Mariana e Depois Toda a casa. Voltar à edição cancelou a ampliação. Transferir para Joana mostrou confirmação de troca e, após confirmar, manteve o PDF privado com o novo ID. Mariana deixou de listar esse arquivo; Joana passou a vê-lo, sem perder seu exemplo anterior.
- Navegação efetiva para Almoxarifado (aguardando o título de destino) e retorno à Biblioteca preservou o PDF nativo, que abriu novamente no leitor. Remover exigiu confirmação e Desfazer restaurou arquivo/destinatário.
- Download pelo leitor produziu leitura-individual.pdf no diretório de downloads do navegador. Nenhum arquivo privado real foi utilizado.
- Arquivo sintético invalid-example.pdf, com conteúdo de texto comum e extensão PDF, foi recusado por assinatura incorreta. O fixture está apenas no diretório de evidências, não no acervo de runtime.
- Criação explícita de material comum com assunto Ervas funcionou. Título A–Z ordenou as quatro leituras de teste; busca vazia ofereceu Limpar filtros; História mostrou só Memória da casa. Filtro por destinatária Mariana exibiu somente seu material privado depois da transferência.
- Vazio, carregamento por esqueleto, erro e Tentar novamente foram exercitados. Os exemplos permanecem preservados; filtros ativos continuam aplicados no estado vazio.
- Em 320px, novo PDF reservado a Mariana com arquivo de exemplo foi salvo. Sua prévia mostrou esse PDF e Plano de leitura de Mariana; a prévia de Joana mostrou o arquivo transferido e Referências para Joana.

## Leitor PDF

PDF.js e worker já instalados, carregados localmente sob demanda. Páginas reais renderizadas em canvas. Conferidos página 1→2, zoom 75% e 300%, texto extraído, download, fechar/Escape e retorno de foco ao botão de abertura. A leitura em 300% possui rolagem dentro do quadro; em 390px, quadro com clientWidth 362/scrollWidth 966, sem alargar a página. O PDF nativo permaneceu legível depois do remonte da rota. Encerrar leitura limpa documento/render e URLs de objeto.

O primeiro carregamento de PDF durante desenvolvimento provocou uma atualização de dependências pelo Vite; a abertura foi repetida após essa atualização. Nas verificações posteriores, o leitor permaneceu aberto e não houve erros/avisos no console. Não constitui teste do build servido separadamente.

## Responsividade e acessibilidade

Conferidos desktop 1920/1440, notebook 1366 e celular 390/320px. ScrollWidth registrado 1914, 1360, 384 e 314 sem overlay; com leitor mobile aberto, largura raiz igual a 320 ou 390, sem overflow. Rolagem horizontal de zoom é interna ao PDF.

Formulário em 390px: largura 358px, rolagem vertical interna; em 320×740: largura 288px entre x=16 e x=304, altura 629px, sem overflow horizontal. Leitor em 320px: largura interna 298px, título, página/zoom, texto extraído e download alcançáveis. Menu, topbar e barra inferior aprovados mantidos; sobreposições modais bloqueiam o fundo. Campos mobile usam 16px. Radio groups, rótulos, títulos/descrições e foco preservados. Texto extraído é alternativa ao canvas, com download para leitor de PDF nativo. Movimento reduzido previsto. Não testado em telefone físico, teclado virtual ou leitor de tela real.

Contraste pontual calculado: verde auxiliar/canvas 5,153:1; texto do privado/lilás 5,413:1; destinatário/branco 6,901:1; capa sálvia 6,749:1; capa areia 5,871:1; nota do PDF 5,077:1. Não equivale a auditoria integral.

## Verificação e limites

TypeScript focado concluído após ajustar a opção ao PDF.js instalado. libraryAccess.check.mjs passou: destinatário exato, outro membro recusado, audiência pública explícita e ausência/valores desconhecidos recusados na visão de membro. Detector rodado uma vez em LibraryPage.tsx e LibraryPdf.tsx: [] em ambos.

Build Vite isolado concluído com 1782 módulos, leitor e worker em chunks próprios. Entrada geral aproximada de 525 kB (152 kB gzip); engine PDF 484 kB (145 kB gzip). A entrada geral da prévia conserva aviso de tamanho acima de 500 kB, já presente na etapa anterior. Não se alterou a arquitetura do aplicativo real para silenciar o aviso. Os quatro PDFs demonstrativos somam cerca de 12 KB; worker aproximadamente 1,26 MB, carregado no fluxo do leitor. Não houve teste de volume grande, PDF de 20 MB, arquivo com senha, documento corrompido com cabeçalho válido ou consumo em rede móvel.

Validação do seletor verifica extensão/MIME, limite de 20 MB e cabeçalho %PDF-. Cabeçalho válido não prova integridade completa; o leitor possui falha com tentativa de reabertura e orientação para trocar arquivo. Sem OCR; PDFs digitalizados podem não fornecer texto extraído.

Os testes validam a simulação de visibilidade local. **Não são prova de autorização de produção.** A origem local não é um armazenamento privado autenticado; PDFs sintéticos são assets do protótipo e todos os dados da prévia vivem na memória da zeladoria. A integração posterior deve impor a mesma regra no servidor e no armazenamento, conforme LIBRARY-INTEGRATION.md. Não adicionar PDFs reais sensíveis a esta prévia. Recarregar reinicia a sessão. Nenhum usuário real recebeu arquivo ou notificação.

Evidências em .impeccable/review/library/. Capturas incluem exemplos iniciais e estados de teste indicados no nome. Entrega final volta aos três PDFs comuns e dois individuais iniciais. Avaliação visual da Biblioteca pertence ao usuário; revisão independente registrada separadamente.


## Revisão independente

Hume revisou o código, os documentos e as capturas em contexto independente e retornou ship no escopo do protótipo local, sem correções materiais. Confirmou destinatário explícito, confirmação de mudança, subconjunto permitido para lista/contagem/leitor/download e honestidade sobre a simulação. Não reexecutou os testes nem auditou produção. Parecer em [REVIEW.md](.impeccable/review/library/REVIEW.md). Aceite visual continua pendente do usuário.
