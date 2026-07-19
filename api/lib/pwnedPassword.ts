import { createHash } from "node:crypto";

type CacheEntry = { expiresAt: number; suffixes: Set<string> };
const prefixCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1_000;

export type PasswordExposureResult = "safe" | "compromised" | "unavailable";

function pruneCache(now: number): void {
  for (const [key, entry] of prefixCache) {
    if (entry.expiresAt <= now) prefixCache.delete(key);
  }
  while (prefixCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = prefixCache.keys().next().value as string | undefined;
    if (!oldest) break;
    prefixCache.delete(oldest);
  }
}

/**
 * Consulta a base Pwned Passwords por k-anonimato. Somente os cinco primeiros
 * caracteres do SHA-1 saem do servidor; a senha e o hash completo nunca saem.
 */
export async function checkPasswordExposure(password: string): Promise<PasswordExposureResult> {
  const value = String(password || "");
  if (!value) return "compromised";

  const hash = createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const now = Date.now();
  let entry = prefixCache.get(prefix);

  if (!entry || entry.expiresAt <= now) {
    pruneCache(now);
    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          "Add-Padding": "true",
          "User-Agent": "AxeCloud-Password-Security/1.0",
        },
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) return "unavailable";
      const text = await response.text();
      const suffixes = new Set<string>();
      for (const line of text.split(/\r?\n/)) {
        const [candidate, rawCount] = line.trim().split(":", 2);
        if (candidate && Number(rawCount) > 0) suffixes.add(candidate.toUpperCase());
      }
      entry = { expiresAt: now + CACHE_TTL_MS, suffixes };
      prefixCache.set(prefix, entry);
    } catch {
      return "unavailable";
    }
  }

  return entry.suffixes.has(suffix) ? "compromised" : "safe";
}

export async function rejectCompromisedPassword(password: string): Promise<void> {
  if ((await checkPasswordExposure(password)) === "compromised") {
    throw Object.assign(
      new Error("Esta senha já apareceu em vazamentos conhecidos. Escolha uma senha diferente."),
      { status: 400 }
    );
  }
}
