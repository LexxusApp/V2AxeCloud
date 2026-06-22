import { timingSafeEqual } from "node:crypto";

/** Comparação timing-safe para secrets de webhook. */
export function secureCompare(a: string, b: string): boolean {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}
