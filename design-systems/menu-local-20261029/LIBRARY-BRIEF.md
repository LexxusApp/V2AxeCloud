# Biblioteca de Estudos — direção local

Mode: Operate/Read. Continuidade da prévia visual local em localhost:5188. O usuário confirmou a próxima página Biblioteca de Estudos e pediu explicitamente um acervo privado: o zelador adiciona um PDF somente para um filho específico. Menu, cabeçalho e barra mobile aprovados preservados. Sem publicação, API ou alteração do sistema real.

Direção: acervo com índice de assuntos e capas tipográficas de identificação; diferentes tons de papel por categoria. Não repetir lista de estoque, hero financeiro ou galeria de fotos. Verde profundo/Inter herdados e lilás discreto identifica material individual. Capas não representam a primeira página do PDF. Exemplos são documentos sintéticos próprios, sem conteúdo religioso inventado ou dados privados reais.

Primeiro viewport: Acervo da casa e Acervo privado claramente separados, ação Adicionar material, índice e PDFs. No privado, destinatário explícito em cada registro e no detalhe. Novo material é privado por padrão e não salva sem filho escolhido. Abrir acesso para todos ou trocar destinatário de um privado exige confirmação antes/depois; cancelar preserva a edição e a visibilidade anterior.

Fluxo central: PDF local de até 20 MB → título/assunto → escolher audiência e destinatário → salvar na memória → testar como membro → conferir que o PDF só aparece para o destinatário. Cada prévia de membro filtra dados, contagens, busca, detalhe, leitor e download usando os registros autorizados da simulação. Membro sem destinatário válido recebe vazio, nunca fallback público. Não há autenticação ou autorização de servidor nesta etapa; a proteção real deverá ser implementada na integração posterior.

Funcionalidade: cadastro/edição/remoção com desfazer, categorias existentes Cantigas/História/Ervas/Orixás/Fundamentos, busca sem acento, ordem por data ou título, filtro de destinatário, leitura real via PDF.js local, página/zoom/texto extraído, download. Não enviar notificação nem arquivo externamente. Arquivos escolhidos são File em memória, URLs de objeto revogadas no desmontar. Dados reiniciam ao recarregar. Sem instalar dependências.

Qualidade: desktop e mobile, rótulos, foco e Escape, falha de PDF, lista vazia, carregamento, erro e recuperação. Motivo visual da cor é a separação comum/individual; não uma promessa de segurança de produção. A avaliação visual da Biblioteca permanece pendente.
