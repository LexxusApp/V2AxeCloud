import type { RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClientIp } from "./clientIp.js";
import { loadGlobalSettingPayload, saveGlobalSettingPayload } from "./globalSettings.js";

const SETTINGS_ID = "blocked_ips";
const CACHE_TTL_MS = 30_000;

type BlockedIpsPayload = {
  ips: string[];
  notes?: Record<string, string>;
  updatedAt?: string;
};

let cache: { ips: Set<string>; loadedAt: number } | null = null;

function normalizeIp(raw: string | null | undefined): string | null {
  let ip = String(raw || "").trim().toLowerCase();
  if (!ip) return null;
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1") ip = "127.0.0.1";
  return ip || null;
}

function parsePayload(raw: unknown): BlockedIpsPayload {
  if (!raw || typeof raw !== "object") return { ips: [] };
  const o = raw as Record<string, unknown>;
  const ips = Array.isArray(o.ips)
    ? o.ips.map((v) => normalizeIp(String(v))).filter((v): v is string => !!v)
    : [];
  const notes =
    o.notes && typeof o.notes === "object" && !Array.isArray(o.notes)
      ? Object.fromEntries(
          Object.entries(o.notes as Record<string, unknown>).map(([k, v]) => [
            normalizeIp(k) || k,
            String(v || "").slice(0, 300),
          ])
        )
      : {};
  return { ips: [...new Set(ips)], notes, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined };
}

export async function loadBlockedIps(sb: SupabaseClient): Promise<Set<string>> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.ips;
  const raw = await loadGlobalSettingPayload(sb, SETTINGS_ID);
  const payload = parsePayload(raw);
  cache = { ips: new Set(payload.ips), loadedAt: now };
  return cache.ips;
}

export async function addBlockedIp(
  sb: SupabaseClient,
  ipRaw: string,
  note?: string
): Promise<{ ip: string; ips: string[] }> {
  const ip = normalizeIp(ipRaw);
  if (!ip || ip === "127.0.0.1" || ip === "unknown") {
    throw new Error("IP inválido para bloqueio.");
  }
  const raw = await loadGlobalSettingPayload(sb, SETTINGS_ID);
  const payload = parsePayload(raw);
  if (!payload.ips.includes(ip)) payload.ips.push(ip);
  payload.notes = payload.notes || {};
  if (note) payload.notes[ip] = note.slice(0, 300);
  payload.updatedAt = new Date().toISOString();
  await saveGlobalSettingPayload(sb, SETTINGS_ID, payload);
  cache = { ips: new Set(payload.ips), loadedAt: Date.now() };
  return { ip, ips: payload.ips };
}

export async function isIpBlocked(sb: SupabaseClient, ipRaw: string | null | undefined): Promise<boolean> {
  const ip = normalizeIp(ipRaw);
  if (!ip) return false;
  const blocked = await loadBlockedIps(sb);
  return blocked.has(ip);
}

/** Middleware cedo: bloqueia API/páginas de auth/cadastro para IPs na denylist. */
export function createIpBlockMiddleware(sb: SupabaseClient): RequestHandler {
  return (req, res, next) => {
    const ip = resolveClientIp(req);
    void isIpBlocked(sb, ip)
      .then((blocked) => {
        if (!blocked) {
          next();
          return;
        }
        console.warn(`[ip-block] blocked ${ip} ${req.method} ${req.path}`);
        if (req.path.startsWith("/api/") || req.path.startsWith("/api")) {
          res.status(403).json({ error: "Acesso negado." });
          return;
        }
        res.status(403).type("html").send("<!doctype html><title>403</title><h1>Acesso negado</h1>");
      })
      .catch((err) => {
        console.warn("[ip-block] check failed:", err instanceof Error ? err.message : err);
        next();
      });
  };
}
