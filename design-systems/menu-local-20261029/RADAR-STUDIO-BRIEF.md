# Radar — estúdio do perfil público, etapa 14

Pedido de 31/10/2026: completar o Radar local com controle integral da apresentação pública, endereço, redes sociais, capa, foto de perfil, dias e horários fixos e galeria exclusiva. As cinco capturas da produção documentam capacidades essenciais; não são um pedido de copiar a composição. Usuário autorizou um Radar visualmente mais ousado, mantendo a identidade do AxéCloud e o shell já aprovado.

## Contrato

Extensão code-led do mundo vigente. Editor em modo Operate; prévia pública combina leitura e fotografia. A abertura usa a capa salva em grande escala, identidade pública e acesso à visão de visitante. Índice de sete seções organiza o trabalho sem repetir a estrutura de métricas das outras páginas. Verde profundo, dourado, Inter, fundo claro e acentos quentes preservam a família visual. Menu, cabeçalho e dock mobile mantidos.

Somente `design-systems/menu-local-20261029`. Sem produção, deploy, API, banco, autenticação ou mensagens. Aceitação visual desta extensão ainda cabe ao usuário. Fotos de exemplo são ilustrações de IA identificadas, reaproveitadas da prévia existente; nenhuma foto particular foi utilizada.

## Capacidades entregues

- Identidade: nome público independente da conta, tradição, biografia, instruções; capa substituível/removível, enquadramento superior/central/inferior e visualização inteira; foto pública própria, com cópia da foto da conta somente por ação explícita.
- Localização: logradouro, número ou sem número, complemento, bairro, CEP, cidade/UF, link Maps, latitude/longitude. Visibilidade de endereço controla a saída pública: ao ocultar, mostra apenas cidade/UF e remove endereço e Maps da prévia.
- Contato: WhatsApp público, canal de atendimentos e até cinco redes distintas entre Instagram, Facebook, TikTok, YouTube e site, com protocolo e domínio validados.
- Rotina: até 14 horários semanais com título, dia, início, término opcional e pausa. Duplicata de dia/início é recusada; próxima ocorrência usa America/Sao_Paulo. Término anterior ao início é identificado como dia seguinte. Não cria eventos na agenda interna.
- Galeria pública independente da Galeria interna: até seis fotos, seleção múltipla, legenda, reordenação, remoção/desfazer e visualizador da imagem inteira.
- Desempenho ilustrativo, publicações e atendimentos conservados. Publicação e visibilidade alteram somente a simulação.
- Rascunho no componente pai sobrevive a trocar de seção e de rota; salvar atualiza somente o perfil público salvo. Prévia usa valores salvos; descartar pede confirmação. Recarregar restaura os exemplos.

## Limites técnicos conscientes

PNG/JPG/WebP, até 8 MB por capa/foto de galeria e 5 MB por retrato; imagem decodificada entre 64×64 e 24 megapixels. Arquivos e URLs temporárias existem apenas em memória, com limpeza no desmontar. Não há compressão, upload remoto ou persistência de negócio. Mapa não é geográfico e não faz geocodificação. Endereços e contatos sintéticos dos testes não saíram da origem local; links externos foram apenas conferidos, não acionados.

Integração futura deverá aplicar autorização por casa no servidor, armazenamento das mídias, processamento/otimização e espelhamento no perfil público real. Esta etapa não promete essas integrações.
