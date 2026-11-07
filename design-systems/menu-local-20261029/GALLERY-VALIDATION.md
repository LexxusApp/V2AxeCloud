# Galeria — prévia local

Etapa de 30/10/2026. A solicitação “Próxima pagina” foi aplicada à Galeria, próxima área do menu após Casa e Financeiro. Escopo somente nesta pasta. Menu, cabeçalho e barra inferior aprovados preservados; o novo visual aguarda avaliação do usuário.

## Composição

Imagens em destaque: álbum principal amplo e duas coleções ao lado no computador, cards empilhados no celular. Texto fora das fotos, sem métricas sobrepostas e sem repetir a abertura financeira. Verde suave nos filtros e visualizador verde profundo. Imagens geradas para demonstração, identificadas como tal; não representam registros reais de uma casa. Procedência e prompts em [assets/gallery/ASSETS.md](assets/gallery/ASSETS.md).

## Fluxos exercitados na interface

- Criar “Revisão local da galeria” usando as três imagens de exemplo: resumo passou de 3 álbuns/3 fotos para 4 álbuns/6 fotos. Abertura mostrou os três registros.
- Trocar capa para flores, dar Axé e filtrar Meu Axé: somente o registro marcado permaneceu, com a capa correspondente.
- Editar legenda: texto revisado apareceu no visualizador, mantendo a indicação de imagem gerada por IA.
- Visualizador avançou de 2 de 3 para 3 de 3 e voltou; Escape restaurou foco ao botão que abriu a foto. Imagem inteira com object-fit contain; sem autoplay de mídia.
- Remover um registro reduziu a coleção de três para dois; Desfazer restaurou. Remover álbum exigiu confirmação e reduziu totais; Desfazer restaurou álbum e registros.
- Navegar para Almoxarifado e retornar preservou o álbum criado, a capa e os dados em memória. Recarregar a prévia ou atualizar o módulo reinicia os exemplos, como previsto.
- Criar álbum sem nome mostrou validação. Criar álbum vazio mostrou orientação para adicionar registros; inclusão posterior das três imagens de exemplo funcionou em 320px.
- Busca sem resultado mostrou estado vazio. Categoria Festas e rituais exibiu só o álbum correspondente. Nome A–Z ordenou Espaços, Os pequenos cuidados e Preparação.
- Ausência de registros, carregamento, falha e Tentar novamente foram exercitados. Os controles alteram a exibição, sem apagar o estado.

## Responsividade e acessibilidade

Conferidas larguras 1920, 1366, 390 e 320px. Não observado overflow horizontal: scrollWidth de 1914/1360/384/314 respectivamente, menor que a largura total devido à barra de rolagem. Álbum e visualizador conferidos no celular. Em 320×740, diálogo de criação ficou entre x=16 e x=304 com rolagem vertical interna; visualizador entre x=10 e x=310, também com rolagem interna quando necessário.

Menu mobile abre a Galeria e conserva a barra inferior. O visualizador cobre a navegação enquanto aberto. Campos usam 16px no celular, ações principais têm alvos de toque de pelo menos 44px, fotos têm texto alternativo, diálogos têm título e descrição, e Escape devolve foco. Abertura mobile foi compactada, retirando o subtítulo repetido da seção; o cabeçalho comum foi preservado. Movimento reduzido previsto no CSS. Não constitui auditoria completa de acessibilidade ou teste em aparelho físico.

## Verificação e limites

TypeScript focado e build Vite isolado concluídos sem erros. Build: 1767 módulos. Detector Impeccable rodado uma vez nesta página: `[]`. Console sem erros ou avisos nos cenários conferidos.

Capturas em `.impeccable/review/gallery/`: desktop, notebook, abertura/álbum mobile e visualizador em 390 e 320px. A captura de 390px do visualizador contém legenda editada durante o teste. A entrega final volta aos três álbuns iniciais.

Implementação aceita PNG/JPEG/WebP até 10 MB, MP4/WebM até 30 MB, até 12 por lote, com verificação de tipo e tamanho. Arquivos escolhidos ficam como File na memória e usam URLs de objeto com limpeza no desmontar. **Nesta etapa, o seletor nativo, arrastar arquivos, vídeo local, download e limites de tamanho não foram exercitados pela interface**; os testes de criação/inclusão usaram a biblioteca explícita de exemplos. Não alegar validação desses fluxos antes de integração.

Originais PNG preservados; WebP usa codificação sem perdas e sem alteração de pixels. Os três arquivos runtime somam aproximadamente 5,3 MiB; não representam otimização final para rede móvel. Primeira capa eager, demais imagens lazy. Não há upload remoto, API, autenticação, quota real, persistência em banco ou sincronização. Meu Axé representa apenas a reação local da pessoa que usa a prévia, sem contagem social fictícia.

Revisão própria em modo degradado, mantendo a indisponibilidade de revisão independente já registrada nas etapas anteriores. Parecer em `.impeccable/review/gallery/SELF-REVIEW.md`. Tudo permanece local; nenhuma publicação ou aprovação visual foi inferida.
