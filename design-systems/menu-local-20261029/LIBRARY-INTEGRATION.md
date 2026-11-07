# Acervo privado — contrato para integração posterior

Este documento não implementa nem modifica produção. O usuário autorizou somente a prévia local até validar. libraryAccess.ts descreve a visibilidade simulada, não autenticação.

Regra de produto: material comum pertence à casa e é visto pela zeladoria e pelos filhos autorizados dessa mesma casa. Material individual pertence à casa e tem destinatário por ID; somente a zeladoria autorizada e esse filho podem listá-lo, ler metadados, abrir PDF ou baixar arquivo. Falta de destinatário nunca significa material comum.

Na integração, essa regra deve ser aplicada no servidor a cada operação e no armazenamento privado, sem depender do filtro visual. Listagem, contagem, busca, capa, detalhes, acesso ao conteúdo e download devem usar a sessão autenticada, a casa e o vínculo atual. Arquivo individual não deve ter URL pública permanente; o fluxo autenticado poderá emitir acesso temporário apenas após verificar autorização. O chamador não pode definir livremente a própria casa ou papel.

Cadastro/alteração deve validar que o filho pertence à mesma casa, persistir audiência explícita, manter arquivo/metadados consistentes e não abrir acesso comum em caso de falha. Trocar destinatário retira o acesso anterior; ampliar para a corrente conserva a confirmação explícita. Revogação e expiração de links temporários precisam respeitar o mecanismo real de armazenamento escolhido. Remoção e restauração conservam a audiência original. Rastreabilidade de alterações deve usar o ator autenticado, não nomes inventados pelo cliente.

Aceite antes de publicar: testar com contas reais de duas casas e dois filhos distintos da mesma casa; verificar acesso direto por ID e por link, inclusive metadados/contagens/capas/download, destinatário removido, troca de destinatário, sessão expirada, restauração e tentativas não autorizadas. Não apresentar apenas esconder um card como proteção do arquivo.

Nenhuma dessas etapas de servidor foi executada nesta fase. A prévia usa apenas PDFs sintéticos e Files locais em memória para validar aparência e fluxo.


O acervo individual desta proposta é diferente do catálogo existente FundamentosAcervo e das regras de plano do sistema atual. Não reutilizar a audiência “individual” como substituto de acesso por assinatura, nem alterar esses direitos ao integrar o formulário. Nesta prévia, Fundamentos é somente um assunto dos PDFs de exemplo; o catálogo restrito de produção não foi copiado ou modificado.
