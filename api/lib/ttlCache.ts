/**
 * Cache TTL para leituras públicas do diretório.
 * Memória no processo Node + Redis opcional (DIR_CACHE_REDIS_URI / CACHE_REDIS_URI).
 */
type CacheEntry = { exp: number; body: string };

const memory = new Map<string, CacheEntry>();
const PREFIX = String(process.env.DIR_CACHE_PREFIX || 'axe:dir:').trim() || 'axe:dir:';

type RedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...args: Array<string | number>) => Promise<unknown>;
};

let redisClient: RedisLike | null = null;
let redisTried = false;

async function getRedis(): Promise<RedisLike | null> {
  if (redisTried) return redisClient;
  redisTried = true;
  const uri = String(
    process.env.DIR_CACHE_REDIS_URI ||
      process.env.CACHE_REDIS_URI ||
      process.env.REDIS_URL ||
      '',
  ).trim();
  if (!uri) return null;
  try {
    const mod = await import('ioredis');
    const Redis = mod.default;
    const client = new Redis(uri, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1500,
      lazyConnect: true,
    });
    client.on('error', (err: Error) => {
      console.warn('[dir-cache] redis:', err.message);
    });
    await client.connect();
    await client.ping();
    redisClient = client;
    console.info('[dir-cache] redis conectado');
    return redisClient;
  } catch (err) {
    console.warn('[dir-cache] redis indisponível, usando só memória:', err);
    redisClient = null;
    return null;
  }
}

function memoryGet(key: string): string | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.body;
}

function memorySet(key: string, body: string, ttlSec: number) {
  memory.set(key, { exp: Date.now() + ttlSec * 1000, body });
  if (memory.size > 400) {
    const now = Date.now();
    for (const [k, v] of memory) {
      if (v.exp <= now) memory.delete(k);
      if (memory.size <= 300) break;
    }
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const full = `${PREFIX}${key}`;
  const local = memoryGet(full);
  if (local) {
    try {
      return JSON.parse(local) as T;
    } catch {
      memory.delete(full);
    }
  }
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(full);
    if (!raw) return null;
    memorySet(full, raw, 60);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const full = `${PREFIX}${key}`;
  let body: string;
  try {
    body = JSON.stringify(value);
  } catch {
    return;
  }
  memorySet(full, body, ttlSec);
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(full, body, 'EX', Math.max(1, Math.floor(ttlSec)));
  } catch {
    /* memória já cobre */
  }
}

export async function cachedJson<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await getCachedJson<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  void setCachedJson(key, value, ttlSec);
  return value;
}
