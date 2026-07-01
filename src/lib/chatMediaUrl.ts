const CHAT_STORAGE_KEY_RE =
  /^chat\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/.+/i;

export function extractChatStorageKey(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;

  if (raw.includes('/api/v1/chat/media')) {
    try {
      const parsed = new URL(raw, 'https://axecloud.com.br');
      const key = parsed.searchParams.get('key')?.replace(/\\/g, '/').trim();
      if (key && CHAT_STORAGE_KEY_RE.test(key)) return key;
    } catch {
      /* ignore */
    }
  }

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const match = decoded.match(
    /chat\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[^/?#]+/i,
  );
  const key = match?.[0] ?? null;
  return key && CHAT_STORAGE_KEY_RE.test(key) ? key : null;
}

export function resolveChatMediaAccess(url: string | null | undefined): {
  directSrc: string | null;
  fetchUrl: string | null;
} {
  const raw = String(url || '').trim();
  if (!raw) return { directSrc: null, fetchUrl: null };

  if (raw.startsWith('blob:') || raw.startsWith('data:')) {
    return { directSrc: raw, fetchUrl: null };
  }

  const storageKey = extractChatStorageKey(raw);
  if (storageKey) {
    return {
      directSrc: null,
      fetchUrl: `/api/v1/chat/media?key=${encodeURIComponent(storageKey)}`,
    };
  }

  return { directSrc: raw, fetchUrl: null };
}

export function chatMediaNeedsAuthFetch(url: string | null | undefined): boolean {
  return resolveChatMediaAccess(url).fetchUrl !== null;
}
