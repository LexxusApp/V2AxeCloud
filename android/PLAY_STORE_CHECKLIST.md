# Publicação do AxéCloud na Google Play

## Já preparado

- Aplicativo nativo `br.com.axecloud.app`, `targetSdk 35`, ícone adaptativo e splash.
- AAB release com redução de recursos e ofuscação validado localmente.
- Política de privacidade: `https://axecloud.com.br/privacidade`.
- Termos de uso: `https://axecloud.com.br/termos`.
- Exclusão permanente da conta disponível dentro do aplicativo.
- Cache offline criptografado com chave protegida pelo Android Keystore.
- Permissões limitadas a internet, rede, notificações e microfone.
- Sincronização periódica de pendências em segundo plano com preferências por categoria e abertura do módulo correto.

Último AAB release validado localmente: `7.460.841 bytes`, SHA-256 `09500402963A100F43EA88EBC8CF9975E0447619AA713DF108459A79B187ED0B`. O arquivo ainda está sem assinatura porque a chave privada de upload não deve ser criada nem armazenada no repositório.

## Segurança dos dados — declaração inicial

O aplicativo processa dados de conta, dados da casa, cadastro de membros, conteúdo enviado pelo usuário, dados financeiros administrativos, fotos, vídeos, documentos e gravações de voz. Esses dados são usados para entregar as funções solicitadas pelo usuário e sincronizados com a infraestrutura do AxéCloud por HTTPS. O aplicativo não deve declarar venda de dados.

Antes do envio, revisar no formulário da Play Console cada categoria efetivamente habilitada em produção, a finalidade, se a coleta é opcional e a política de retenção da conta.

## Dependências para a primeira versão pública

- Criar a chave de upload e guardar cópia segura fora do repositório.
- Informar `AXECLOUD_KEYSTORE_PATH`, `AXECLOUD_KEYSTORE_PASSWORD`, `AXECLOUD_KEY_ALIAS` e `AXECLOUD_KEY_PASSWORD` no ambiente local de release.
- Criar o projeto Firebase vinculado ao pacote e fornecer `google-services.json` para o transporte de push em segundo plano.
- Executar testes instrumentados no aparelho físico e validar login de zelador e filho de santo.
- Capturar screenshots finais em telefone de 6,5 polegadas e tela de 7/10 polegadas.
- Preencher nome, descrição curta, descrição completa, categoria, e-mail de suporte e classificação indicativa.
- Publicar primeiro na faixa de teste interno e verificar Android Vitals antes da produção.
