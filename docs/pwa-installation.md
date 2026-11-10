# Instalação do AxéCloud na interface nova

- Gestão: **Instalar app** nas opções da foto no topo, inclusive para coadministradores.
- Membro/filho de santo: **Instalar app** no menu lateral e no menu lateral do celular; a área Meu dispositivo usa a mesma ação.
- O evento de instalação é capturado no HTML antes da validação de sessão, em desktop e celular. Os dois painéis registram o service worker oficial `/sw.js`, no escopo `/`, em produção.
- Chrome/Edge abrem a confirmação nativa quando o navegador oferece o evento. Cada evento é usado uma única vez, inclusive após cancelamento ou erro. A instalação só é marcada como concluída após `appinstalled` ou detecção do aplicativo instalado.
- Sem evento disponível, o botão continua acessível e mostra instruções. iPhone e iPad (incluindo modo desktop) recebem orientações para o Safari. O botão some no aplicativo instalado.
- Sem alteração de `SYSTEM_VERSION`, limpeza de sessão ou novo service worker.

## Validação realizada em 10/11/2026

1. `node --import tsx --test tests/pwaInstall.test.ts`: 4 testes passaram, cobrindo captura antes do boot, desktop, cancelamento, evento expirado, duplo clique, nova tentativa, instalação concluída, iOS/iPadOS e identificação do próprio aplicativo.
2. `node scripts/build-pilot-interface.mjs`: builds de gestão e membro passaram.
3. `node scripts/test-pwa-install.mjs`: 6 cenários passaram no Chromium com os bundles reais e APIs/sessão fictícias locais. Incluem os dois painéis em desktop e celular, instruções, botões, teclado, largura da janela, cancelamento, nova tentativa e ocultação após instalação. Incluem também orientação para iPhone por emulação de user agent e execução standalone. O evento nativo de instalação é simulado; não instala aplicativos no computador do usuário.
4. `node scripts/check-architecture-budgets.mjs`: passou.
5. Leitura pública de produção: manifest, service worker e ícones de 192/512 responderam HTTP 200, com tipos de conteúdo corretos. Manifest mantém identidade, escopo `/`, modo standalone e início em `/entrar`.
6. `npm run lint:release`: aprovado na verificação anterior à publicação. Os dois erros preexistentes apontados na checagem inicial foram corrigidos na main antes desta publicação.

Logs e capturas locais: `artifacts/pwa-install-check/`. O pacote de publicação e as verificações de produção ficam em `artifacts/pwa-deploy/`.

A publicação autorizada usa a fonte da versão dos painéis já publicada, com somente o patch de instalação aplicado. Os builds e os testes de lógica e navegador foram repetidos nesse pacote isolado. O código do Worker atual e os donos das rotas são preservados; a API e o aplicativo de entrada não precisam ser publicados.
