import type { Request } from "express";
import { resolveClientIp } from "./clientIp.js";

type FailBucket = { count: number; resetAt: number; lockedUntil: number };

const failBuckets = new Map<string, FailBucket>();

const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_PER_ACCOUNT = 20;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const MAX_BUCKETS = 10_000;

function cleanupExpired(now: number): void {
  for (const [key, bucket] of failBuckets) {
    if (bucket.resetAt <= now && bucket.lockedUntil <= now) failBuckets.delete(key);
  }
  while (failBuckets.size >= MAX_BUCKETS) {
    const oldest = failBuckets.keys().next().value as string | undefined;
    if (!oldest) break;
    failBuckets.delete(oldest);
  }
}

function normalizedChildKey(childIdPrefix: string): string {
  return String(childIdPrefix || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
}

function ipBucketKey(childIdPrefix: string, req: Request): string {
  const prefix = normalizedChildKey(childIdPrefix);
  return `ip:${prefix}:${resolveClientIp(req) || "unknown"}`;
}

function accountBucketKey(childIdPrefix: string): string {
  const prefix = String(childIdPrefix || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
  return `account:${prefix}`;
}

function isBucketLocked(key: string, now: number): boolean {
  const bucket = failBuckets.get(key);
  if (!bucket) return false;
  if (bucket.lockedUntil > now) return true;
  if (bucket.resetAt <= now) failBuckets.delete(key);
  return false;
}

function recordFailure(key: string, maxFailures: number, now: number): void {
  let bucket = failBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + FAIL_WINDOW_MS, lockedUntil: 0 };
  }
  bucket.count += 1;
  if (bucket.count >= maxFailures) bucket.lockedUntil = now + LOCK_MS;
  failBuckets.set(key, bucket);
}

export function filhoLoginIsLocked(childIdPrefix: string, req: Request): boolean {
  const now = Date.now();
  return (
    isBucketLocked(ipBucketKey(childIdPrefix, req), now) ||
    isBucketLocked(accountBucketKey(childIdPrefix), now)
  );
}

export function recordFilhoLoginFailure(childIdPrefix: string, req: Request): void {
  const now = Date.now();
  cleanupExpired(now);
  recordFailure(ipBucketKey(childIdPrefix, req), MAX_FAILURES_PER_IP, now);
  recordFailure(accountBucketKey(childIdPrefix), MAX_FAILURES_PER_ACCOUNT, now);
}

export function clearFilhoLoginFailures(childIdPrefix: string, req: Request): void {
  failBuckets.delete(ipBucketKey(childIdPrefix, req));
  failBuckets.delete(accountBucketKey(childIdPrefix));
}
