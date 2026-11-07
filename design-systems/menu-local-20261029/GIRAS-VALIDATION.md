# Giras — prévia local de 29/10/2026

Etapa autorizada por “Continua”, após a entrega de Filhos de Santo. Menu, cabeçalho e Dashboard mantêm o desenho anteriormente validado. Não foi inferido novo aceite visual para Filhos de Santo ou Giras. Nenhuma publicação foi realizada.

## Escopo

`GirasPage.tsx`, `giras.css` e `giras.ts` implementam a agenda local: busca, filtros de próximas/realizadas/todas, calendário mensal, cadastro e edição. O detalhe do encontro reúne Presenças, Preparação, Aviso e orientações, Operação e senhas.

Todos os dados são sintéticos. O relógio de referência do cenário é 29/10/2026; o usuário é avisado de que datas e eventos são demonstrativos. A fila usa senhas de teste, sem expor dados de consulentes. Avisos são rascunhos, explicitamente não enviados. Nenhum convite, WhatsApp, notificação, senha pública ou chamada real é criado.

Giras ficam em memória no componente principal. A Dashboard consome a mesma próxima gira e respostas; o perfil do membro mostra a mesma data e horário. Estilos da navegação e da Dashboard não foram redesenhados. Preceito fica associado ao ID do encontro, e a janela de ativação identifica a gira correspondente. Recarregar restaura os exemplos.

## Cenários verificados

| Cenário | Resultado observado |
| --- | --- |
| Agenda inicial | Caboclo em 31/10 20:00 e Preto-Velho em 14/11 19:30; histórico de 24/10 separado. |
| Filtro Realizadas | Lista e detalhe mudam para Encontro da corrente, de 24/10. |
| Respostas | Beatriz confirmada e Davi ausente: 7 confirmados, 1 ausência e 0 sem resposta. Dashboard exibe os mesmos estados individuais. |
| Preparação | Inicial 2/6; respostas completas, materiais marcados e aviso revisado levam a 5/6. Não se marca a corrente completa enquanto faltam respostas. |
| Aviso | Texto do encontro gerado e rascunho salvo com “Revisado · não enviado”. |
| Operação | Senha 01: aguardando → em atendimento → concluída; totais atualizados em cada etapa. |
| Preceito | Ativação simulada identifica Caboclo; volta à preparação com ciclo ativo. Encontro realizado não permite iniciar novo ciclo. |
| Edição | Data e horário alterados para 30/10 19:45; agenda, Dashboard, linha do tempo e perfil do membro mostram os mesmos valores. |
| Campos nativos | Entrada de data/hora capturada também no evento input; evita salvar o valor antigo quando o campo visual já mudou. Mesmo tratamento aplicado às datas do cadastro local de membros; entrada de Mariana alterada para 12/06/2020 e conferida. |
| Nova gira | Encontro de demonstração criado em 07/11; foco retorna ao título do detalhe e nenhum convite é enviado. |
| Data anterior | Agendada em 28/10 apresenta erro orientando escolher Realizada; corrigir para 07/11 permite salvar. |
| Calendário | Próximo mês e dia 07/11 selecionam o encontro criado e filtram a agenda por data. |
| Estados | Vazio mostra orientação de primeira gira; falha permite tentar novamente; carregamento permite concluir a simulação. Os cenários não apagam a coleção de exemplos. |
| Teclado | Organizar gira leva o foco ao detalhe; Escape no editor devolve foco a Editar gira. |

## Responsividade e compilação

Verificações no navegador em 1920×1080, 1366×900, 390×844 e 320×812. Documento sem rolagem horizontal; em 320px, clientWidth e scrollWidth foram 314px. Diálogo mobile de 358px em viewport de 390px. Calendário e agenda empilham; seções da organização usam duas colunas de botões no celular e a barra inferior permanece presente.

TypeScript focado em `main.tsx`: código 0. Build Vite isolado: código 0, 1737 módulos. Detector Impeccable executado uma vez em `GirasPage.tsx`: `[]`. Último carregamento sem erros ou avisos de console capturados. Isso não equivale a auditoria completa de acessibilidade nem a teste em aparelho físico.

## Evidências e revisão

Capturas em `.impeccable/review/giras/`: `desktop.jpg`, `desktop-preparation.jpg`, `laptop.jpg`, `mobile.jpg`, `mobile-preparation.jpg`, `mobile-320.jpg`. Capturas de preparação mostram a posição de rolagem do detalhe; imagens de viewport podem excluir a largura da barra de rolagem do navegador.

Revisão própria substituiu a revisão independente indisponível, conforme procedimento degradado da skill Impeccable. Parecer em `.impeccable/review/giras/SELF-REVIEW.md`, limitado à entrega para avaliação local. Giras ainda aguarda aceite do usuário. Autenticação, permissões, APIs, dados financeiros reais e produção não fazem parte desta etapa.

## Registro do sistema visual

Paleta: verde profundo, dourado pontual e superfícies claras da base aprovada.
Tipo: Inter; títulos 20–29px, linhas do encontro 16–22px e campos mobile 16px.
Composição: resumo sem cartões isolados, agenda com calendário lateral e organização abaixo.
Controles: seleção por data, filtros, respostas individuais, checklist e rascunhos explicitamente locais.
Estados: foco visível, retorno após diálogo, ausência de registros, erro, carregamento e movimento reduzido.

Sem nova identidade visual promovida a produção ou elementos decorativos adicionados ao sistema como regra permanente.
