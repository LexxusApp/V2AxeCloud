# AxéCloud Android

Aplicativo Android nativo criado em Kotlin e Jetpack Compose.

## Identidade

- Nome: AxéCloud
- Application ID: `br.com.axecloud.app`
- Interface: Jetpack Compose
- API: `https://axecloud.com.br/`
- Autenticação e dados: Supabase
- Push: Supabase como origem e histórico; FCM como transporte Android

## Estrutura

- `core`: sessão, rede e utilitários compartilhados
- `designsystem`: identidade visual e componentes nativos
- `feature/auth`: entrada de zelador e filho de santo
- `feature/home`: painel adaptado ao zelador ou filho, agenda, avisos, rotina e perfil

## O que já funciona

- Login do zelador pela autenticação do Supabase
- Login do filho pelo registro AxéCloud e seis primeiros números do CPF
- Sessão criptografada no Android Keystore
- Identificação automática do perfil e do terreiro
- Home com indicadores reais da casa
- Agenda, notificações, preceitos, biblioteca e conversas carregados pela API existente
- Navegação inferior e identidade visual nativas

## Build local

Crie `local.properties` apontando para o Android SDK. As variáveis `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` podem vir do `.env` da raiz, do ambiente ou do próprio
`local.properties`. Depois execute `gradlew.bat assembleDebug`.

O APK de desenvolvimento é criado em `app/build/outputs/apk/debug/app-debug.apk`.
