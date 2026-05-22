/**
 * Chave pública VAPID (só a pública no cliente).
 * O par com a chave **privada** no servidor (api/index.ts, server.ts) tem que ser o mesmo.
 */
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";
