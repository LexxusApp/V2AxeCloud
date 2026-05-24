import type { Request } from "express";

type FailBucket = { count: number; resetAt: number; lockedUntil: number };

const failBuckets = new Map<string, FailBucket>();

const MAX_FAILURES = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  return String(raw || (req as any).socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function bucketKey(childIdPrefix: string, req: Request): string {
  const prefix = String(childIdPrefix || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
  return `${prefix}:${clientIp(req)}`;
}

export function filhoLoginIsLocked(childIdPrefix: string, req: Request): boolean {
  const b = failBuckets.get(bucketKey(childIdPrefix, req));
  if (!b) return false;
  const now = Date.now();
  if (b.lockedUntil > now) return true;
  if (b.resetAt <= now) {
    failBuckets.delete(bucketKey(childIdPrefix, req));
    return false;
  }
  return false;
}

export function recordFilhoLoginFailure(childIdPrefix: string, req: Request): void {
  const key = bucketKey(childIdPrefix, req);
  const now = Date.now();
  let b = failBuckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + FAIL_WINDOW_MS, lockedUntil: 0 };
  }
  b.count += 1;
  if (b.count >= MAX_FAILURES) {
    b.lockedUntil = now + LOCK_MS;
  }
  failBuckets.set(key, b);
}

export function clearFilhoLoginFailures(childIdPrefix: string, req: Request): void {
  failBuckets.delete(bucketKey(childIdPrefix, req));
}
