/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** URL do serviço WhatsApp no Railway (sem barra final); injetada em build pelo `vite.config.ts`. */
  readonly AXE_WHATSAPP_NODE_BASE_URL?: string;
}
