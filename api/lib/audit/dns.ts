/**
 * Helper de DNS / WHOIS / SPF / DMARC / DKIM para a auditoria.
 *
 * Fontes: `dns/promises` (Node nativo) + `whois-json` (TCP whois).
 *
 * Tudo é "best effort" — nunca lançamos para o caller. Em caso de falha,
 * retornamos null/undefined no campo correspondente para o UI tratar.
 */

import { promises as dns } from "node:dns";
// @ts-expect-error sem typings
import whoisJson from "whois-json";

const DNS_TIMEOUT_MS = 5_000;

async function withTimeout<T>(p: Promise<T>, ms = DNS_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    p.catch(() => null as any),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export type DnsRecords = {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: { exchange: string; priority: number }[];
  ns: string[];
  txt: string[];
};

export type EmailAuth = {
  spf: { found: boolean; record: string | null; valid: boolean; notes: string[] };
  dmarc: { found: boolean; record: string | null; policy: string | null; notes: string[] };
  dkim: { selector: string; record: string }[];
};

export type WhoisInfo = {
  registrar: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  status: string[] | null;
  nameservers: string[] | null;
  raw: Record<string, unknown>;
};

export type DnsReport = {
  domain: string;
  records: DnsRecords;
  email: EmailAuth;
  whois: WhoisInfo | null;
};

function toHostname(input: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    return u.hostname;
  } catch {
    return input.replace(/^https?:\/\//i, "").split("/")[0];
  }
}

function rootDomain(hostname: string): string {
  // Heurística simples; cobre 99% dos casos comuns.
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 2) return hostname;
  // domínios .com.br / .co.uk / .net.br etc. (lista curta)
  const tld2 = ["com.br", "net.br", "org.br", "co.uk", "co.jp", "com.au", "com.mx", "co.in"];
  const lastTwo = parts.slice(-2).join(".");
  const lastThree = parts.slice(-3).join(".");
  if (tld2.includes(lastTwo) && parts.length >= 3) {
    return lastThree;
  }
  return lastTwo;
}

async function resolveA(host: string): Promise<string[]> {
  return (await withTimeout(dns.resolve4(host))) || [];
}
async function resolveAAAA(host: string): Promise<string[]> {
  return (await withTimeout(dns.resolve6(host))) || [];
}
async function resolveCname(host: string): Promise<string[]> {
  return (await withTimeout(dns.resolveCname(host))) || [];
}
async function resolveMx(host: string): Promise<{ exchange: string; priority: number }[]> {
  return ((await withTimeout(dns.resolveMx(host))) as any) || [];
}
async function resolveNs(host: string): Promise<string[]> {
  return (await withTimeout(dns.resolveNs(host))) || [];
}
async function resolveTxt(host: string): Promise<string[][]> {
  return ((await withTimeout(dns.resolveTxt(host))) as any) || [];
}

// ---------- SPF / DMARC / DKIM ----------

function flattenTxt(records: string[][]): string[] {
  return records.map((parts) => parts.join("")).filter(Boolean);
}

function analyzeSpf(records: string[]): EmailAuth["spf"] {
  const spfs = records.filter((r) => /^v=spf1\b/i.test(r));
  if (spfs.length === 0)
    return { found: false, record: null, valid: false, notes: ["Sem registro SPF (TXT v=spf1)."] };
  if (spfs.length > 1)
    return {
      found: true,
      record: spfs[0],
      valid: false,
      notes: ["Múltiplos registros SPF — apenas um é permitido."],
    };
  const r = spfs[0];
  const notes: string[] = [];
  if (!/[?~+\-]all\b/i.test(r)) notes.push("Falta mecanismo 'all' (use -all ou ~all).");
  if (/\+all\b/i.test(r)) notes.push("'+all' é inseguro (qualquer servidor pode enviar).");
  return { found: true, record: r, valid: notes.length === 0, notes };
}

function analyzeDmarc(records: string[]): EmailAuth["dmarc"] {
  const dmarcs = records.filter((r) => /^v=DMARC1\b/i.test(r));
  if (dmarcs.length === 0)
    return { found: false, record: null, policy: null, notes: ["Sem registro DMARC."] };
  const r = dmarcs[0];
  const policyMatch = /\bp=(none|quarantine|reject)\b/i.exec(r);
  const policy = policyMatch ? policyMatch[1].toLowerCase() : null;
  const notes: string[] = [];
  if (!policy) notes.push("DMARC sem política (p=).");
  if (policy === "none") notes.push("Política 'none' apenas monitora — considere quarantine/reject.");
  return { found: true, record: r, policy, notes };
}

const DKIM_COMMON_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mail", "smtp", "dkim"];

async function probeDkim(rootDomainName: string): Promise<EmailAuth["dkim"]> {
  const found: EmailAuth["dkim"] = [];
  await Promise.all(
    DKIM_COMMON_SELECTORS.map(async (sel) => {
      const host = `${sel}._domainkey.${rootDomainName}`;
      try {
        const txt = await withTimeout(dns.resolveTxt(host), 2500);
        if (txt && (txt as any).length) {
          const value = ((txt as any)[0] as string[]).join("");
          if (/v=DKIM1\b/i.test(value) || /\bp=/i.test(value)) {
            found.push({ selector: sel, record: value.slice(0, 200) });
          }
        }
      } catch {
        /* ignore */
      }
    })
  );
  return found;
}

// ---------- WHOIS ----------

function parseDate(s: any): string | null {
  if (!s) return null;
  const d = new Date(String(s));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function lookupWhois(rootDomainName: string): Promise<WhoisInfo | null> {
  try {
    const raw = (await withTimeout(whoisJson(rootDomainName, { follow: 2, timeout: 6000 }), 8000)) as Record<
      string,
      unknown
    > | null;
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, any>;
    const expiresAt =
      parseDate(r.registryExpiryDate) ||
      parseDate(r.expirationDate) ||
      parseDate(r.expires) ||
      parseDate(r.expiry) ||
      parseDate(r.registrarRegistrationExpirationDate);
    const createdAt =
      parseDate(r.creationDate) || parseDate(r.created) || parseDate(r.registered) || parseDate(r.createdOn);
    const updatedAt = parseDate(r.updatedDate) || parseDate(r.lastUpdated) || parseDate(r.updated);
    const daysUntilExpiry = expiresAt
      ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
      : null;
    const ns = Array.isArray(r.nameServers)
      ? r.nameServers
      : typeof r.nameServer === "string"
        ? r.nameServer.split(/\s+/).filter(Boolean)
        : null;
    const status =
      typeof r.domainStatus === "string"
        ? r.domainStatus.split("\n").map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(r.status)
          ? r.status
          : null;
    return {
      registrar: r.registrar || r.sponsoringRegistrar || null,
      createdAt,
      updatedAt,
      expiresAt,
      daysUntilExpiry,
      status,
      nameservers: ns ? (ns as string[]).map((n) => String(n).toLowerCase()) : null,
      raw,
    };
  } catch {
    return null;
  }
}

// ---------- Entry point ----------

export async function dnsReport(input: string): Promise<DnsReport> {
  const host = toHostname(input);
  const root = rootDomain(host);

  const [a, aaaa, cname, mx, ns, txtRaw, dkim, whois] = await Promise.all([
    resolveA(host),
    resolveAAAA(host),
    resolveCname(host),
    resolveMx(root),
    resolveNs(root),
    resolveTxt(root),
    probeDkim(root),
    lookupWhois(root),
  ]);

  // DMARC vive em _dmarc.<root>
  const dmarcRaw = await resolveTxt(`_dmarc.${root}`);
  const txt = flattenTxt(txtRaw);
  const dmarcTxt = flattenTxt(dmarcRaw);
  const spf = analyzeSpf(txt);
  const dmarc = analyzeDmarc(dmarcTxt);

  return {
    domain: root,
    records: { a, aaaa, cname, mx, ns, txt },
    email: { spf, dmarc, dkim },
    whois,
  };
}
