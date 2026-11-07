# Histórico de WhatsApp — validação local, etapa 15

31/10/2026. Somente `http://localhost:5188/#settings`, WhatsApp → Histórico de disparos. Nenhum envio ou acesso a serviço externo.

## Verificado

- TypeScript focado em main.tsx e dependências: saída 0. Houve conflito inicial de nomes entre WhatsAppHistory.tsx e whatsappHistory.ts no Windows; dados renomeados para whatsappDispatches.ts, importações corrigidas, página recarregada e compilação aprovada.
- Cinco grupos puros aprovados: períodos/contagens, limiar de dia de Brasília/futuro/data inválida, evento mais recente/cronologia, busca e filtros combinados, ordem e imutabilidade. Datas fixas, nunca recalculadas como Agora ao abrir.
- Vite 1804 módulos, 13,02s, Settings JS 19,24 kB (6,29 kB gzip), CSS 8,19 kB. Entrada geral 542,04 kB mantém aviso acima de 500 kB; não é deploy de produção.
- Detector executado uma vez nos três TSX alterados e CSS. Saída 0, zero apontamentos primários e 31 orientações de alinhamento ao DESIGN: 25 cores, três raios e três tamanhos. Resultado integral em `.impeccable/review/whatsapp-history/detector.json`; não é saída vazia e não houve repetição. Tons verdes, argila de falha e areia de pendência seguem a semântica local; o revisor recebe essas orientações.

## Navegador

1366×900, 390×844 e 320×740. Em 390px, documento 384px; em 320px, 314px, sem transbordamento horizontal. Capturas desktop.jpg, mobile.jpg e narrow-320.jpg abertas e inspecionadas. Formulário de automações e navegação aprovados preservados.

Sete dias mostram oito registros, com quatro sucessos, duas falhas e dois em andamento. Filtro Falhas abre dois; Bruno exibe motivo e orientação, conteúdo e eventos 10:35:00 → 10:35:20 em Brasília. Resultado ausente oferece Limpar filtros e recupera lista. Página 2 indica 7–8 de oito registros. Trocar tipo retorna à página 1. Cantina: um registro em sete dias, dois em todo o histórico; JOAO encontra João sem acento. Seleções nativas conferidas por nome acessível do combobox.

Alterar antecedência para cinco dias, visitar histórico e voltar preserva o rascunho em cinco; descartar restaura preferência salva. Desconectar por confirmação mantém oito registros históricos. Summary nativo dos detalhes abre com Enter; seus filhos de detalhe são alcançáveis sem modal. Telefones são mascarados, não há reenvio ou exclusão real.

Logs antigos do HMR preservaram o erro inicial de nome de módulo; ele foi corrigido antes das verificações funcionais acima. A entrega será restaurada com os exemplos iniciais. Aceite visual da extensão permanece pendente do usuário.

## Entrega

Hooke retornou disposition ship para a extensão delimitada, sem correções materiais, por fontes e capturas fornecidas. Não fez testes independentes. Após restaurar os exemplos por reload, WhatsApp/Histórico abriu com oito registros em sete dias, conexão simulada inicial e nenhum aviso/erro novo desde esse recarregamento (logs filtrados pelo horário da ação retornaram []). history-final.jpg em 1366×900 foi aberto e inspecionado: filtros, sucesso e falha visíveis. Viewport restaurado e aba marcada como entrega. Nenhum commit, deploy, mensagem ou alteração de produção.
