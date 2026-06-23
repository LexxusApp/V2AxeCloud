import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { URL } from "node:url";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateOrReservedIpv4(ip);
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
  }
  return false;
}

async function assertResolvedHostsSafe(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("URL não permitida para auditoria.");
  }
  if (isIP(host) && isPrivateOrReservedIp(host)) {
    throw new Error("URL não permitida para auditoria.");
  }
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error("URL não permitida para auditoria.");
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("não permitida")) throw err;
    throw new Error("Não foi possível resolver o host da URL.");
  }
}

/** Valida URL externa antes de fetch (anti-SSRF para audit scan). */
export async function assertSafeExternalUrl(input: string): Promise<URL> {
  let raw = (input || "").trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("URL inválida.");
  }
  if (!u.hostname || !/\./.test(u.hostname)) {
    throw new Error("URL inválida.");
  }
  if (u.username || u.password) {
    throw new Error("URL não permitida para auditoria.");
  }
  await assertResolvedHostsSafe(u.hostname);
  return u;
}
