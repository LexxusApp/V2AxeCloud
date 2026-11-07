# Conexão real da interface aprovada — porta 5188

Atualizado em 01/11/2026. A própria interface original é carregada por `connected.ts`, após autenticação. Não é a interface da porta 5191.

## Como testar

1. Abra http://localhost:5188/entrar e entre com a conta da casa de teste autorizada.
2. O login leva ao painel desta mesma porta. O menu e os componentes são os aprovados no protótipo.
3. Comece por cadastro, lançamento mensal antigo, baixa, entrada/saída e consumo da cantina. Confira o resultado depois de atualizar a página e no portal do membro.
4. As operações são reais: os servidores e o banco são os do sistema atual. A publicação do novo visual não foi realizada.

Para iniciar novamente, execute `node design-systems/menu-local-20261029/serve.mjs` na raiz do repositório. A porta é fixa; o servidor não troca silenciosamente para outra porta.

## Ligação implementada

| Área | Leitura e operações conectadas |
|---|---|
| Login e conta | Autenticação existente, identificação do terreiro no servidor, perfil, foto e preferências compatíveis |
| Início | Indicadores de membros, agenda, financeiro, Radar, WhatsApp e ativação a partir dos dados reais |
| Membros | Lista, cadastro, edição, vínculo financeiro, anotações reservadas |
| Financeiro | Extrato completo, entradas/saídas manuais, edição, cancelamento, exportação dos registros consultados |
| Mensalidades | Competência antiga, juros fixos/percentuais, vínculo ao membro, pendência, baixa e estorno pelas regras atuais |
| Pix | Consulta e gravação da configuração usada pelo portal atual |
| Cantina | Cardápio, itens e quantidades, venda à vista, caderneta, acerto e limite compartilhado com a loja |
| WhatsApp | Histórico real dos 50 registros mais recentes; solicitação de envio de mensalidade/cantina com modelo oficial |
| Giras | Agenda, criação/edição, respostas, atualização de senhas já emitidas |
| Preceito | Consulta, ativação com orientações cadastradas e período até o início da gira, encerramento |
| Obrigações e frequência | Compromissos vinculados, PDF enviado, conclusão, marcações e fechamento/reabertura de chamada |
| Mural e conversas | Publicação para toda a corrente, edição, conversas, envio de texto/anexos e leitura |
| Galeria | Álbuns, envio de múltiplos arquivos reais, edição de título/legenda e remoção |
| Almoxarifado | Itens, categoria, quantidade e mínimo nos campos existentes |
| Biblioteca | Consulta autorizada, leitura/baixar PDF, publicação com destinatário quando a API confirma essa capacidade |
| Loja | Produtos/fotos, estoque, checkout, caderneta, confirmação/cancelamento/estorno pelos serviços atuais |
| Radar | Perfil público, endereço, Instagram, foto/capa/galeria, horários iniciais, publicações e serviços |
| Assinatura e suporte | Leitura de plano/preços; envio real do pedido de suporte, sem inventar respostas ou histórico remoto |

## Limitações que impedem chamar esta versão de 100% homologada

O contrato atual não atende todas as funções extras do protótipo. Nessas ações a interface preserva o formulário e mostra uma mensagem; não grava uma simulação como se fosse real.

- Renovação/pagamento e encerramento da assinatura ainda exigem o checkout seguro completo; o botão de simulação não altera o contrato real.
- Preferências globais extras do WhatsApp e pareamento/desconexão do canal oficial não são simulados. Lembretes de gira seguem a configuração por evento.
- Mensalidade pendente pode ser antiga; a baixa pela rota atual registra o recebimento hoje. Datas de recebimento diferentes precisam de compatibilidade do servidor. Estornos seguem as restrições atuais do serviço.
- Checklist e rascunho de gira, emissão de senha sem nome do consulente e destaque não têm gravação equivalente conectada.
- Mural com público selecionado, vínculo a gira e rascunhos não têm equivalente no serviço publicado; grupos de conversa devem corresponder ao grupo que a API cria.
- Arquivamento de conversa/produto, entrega separada de pagamento na loja, edição de PDF existente e descrição do material dependem de serviços/campos adicionais.
- Almoxarifado não possui campos para unidade alternativa, localização, observações ou histórico detalhado de movimentos nesta API. Mínimo zero na criação é recusado porque o serviço atual o substitui por cinco.
- Radar: outras redes além de Instagram, posição da capa, privacidade apenas do endereço, legendas das imagens e horário final requerem contrato adicional. Não são descartados silenciosamente.
- A API da galeria registra reações agregadas; não oferece favoritos individuais nem campo para capa escolhida do álbum. Recuperação de arquivos apagados da Biblioteca não existe no serviço atual.
- Histórico do WhatsApp informa criação e situação atual. Horários de entrega/leitura não recebidos não são inventados. O acerto da cantina possui data, mas o serviço financeiro não informa o horário exato; esse detalhe ainda exige ajuste.
- Rascunhos de formulário, carrinhos não enviados e recibos da solicitação ao suporte são estado da visita; não representam novos serviços de armazenamento remoto.

## Verificações desta etapa

- TypeScript focado aprovado após a revisão final.
- Onze testes de leitura/vínculo/cálculo financeiro passaram, incluindo rejeitados, cancelados, juros, competência, baixa e propriedade do lançamento.
- Build final da interface conectada passou (1.880 módulos). Aviso de tamanho do pacote principal permanece.
- Vinte e dois caminhos HTTP responderam sem 404/5xx. APIs protegidas recusaram a consulta sem login; isto não equivale a teste autenticado de negócio.
- Os 24 arquivos CSS foram comparados por SHA-256 e estão intactos.
- A tela de login da própria 5188 foi verificada no navegador. A validação autenticada com a conta de teste permanece pendente da entrada do usuário nessa porta; não foram criados lançamentos, enviados WhatsApps ou realizadas baixas pela automação nesta etapa.

Evidências locais: `artifacts/preview-5188/connection-check.json`, testes `tests/preview5188ReadModels.test.ts`, build `artifacts/preview-5188/verified-build`.

Esta entrega permite iniciar testes dos fluxos conectados. Ainda não autoriza considerar a troca de produção homologada.
