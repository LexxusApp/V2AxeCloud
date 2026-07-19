export type SafePushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { auth: string; p256dh: string };
};

const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

export function normalizePushSubscription(value: unknown): SafePushSubscription | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, any>;
  const endpoint = String(raw.endpoint || "").trim();
  const auth = String(raw.keys?.auth || "").trim();
  const p256dh = String(raw.keys?.p256dh || "").trim();
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" || endpoint.length > 2048) return null;
  } catch {
    return null;
  }
  if (!auth || auth.length > 256 || !BASE64URL_RE.test(auth)) return null;
  if (!p256dh || p256dh.length > 512 || !BASE64URL_RE.test(p256dh)) return null;
  const expiration = raw.expirationTime == null ? null : Number(raw.expirationTime);
  if (expiration !== null && (!Number.isFinite(expiration) || expiration < 0)) return null;
  return { endpoint, expirationTime: expiration, keys: { auth, p256dh } };
}
