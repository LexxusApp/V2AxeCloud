/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Origem do backend (sem barra final) quando o front não é same-origin com a API — ex.: https://seu-app.railway.app */
  readonly VITE_API_ORIGIN?: string;
}
