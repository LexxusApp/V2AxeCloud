import fs from "fs";
import https from "https";
import path from "path";
import axios, { type AxiosInstance } from "axios";
import { resolveEfiEnv, type EfiEnv } from "./efiPay.js";

export type EfiPixEnv = EfiEnv & {
  baseUrl: string;
  pixKey: string;
  certPfx: Buffer;
  certCacheKey: string;
  certPassphrase: string;
};

let cachedPixToken: { token: string; expiresAt: number } | null = null;
const httpsAgentByCert = new Map<string, https.Agent>();

function stripEnvQuotes(value: string): string {
  const t = value.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/** Remove prefixo data-URI, "base64:" e espaços/quebras comuns em secrets da Vercel. */
function normalizeBase64CertInput(raw: string): string {
  let trimmed = stripEnvQuotes(raw);
  const comma = trimmed.indexOf(",");
  if (comma > 0 && /^data:[^;]+;base64,/i.test(trimmed.slice(0, comma + 1))) {
    trimmed = trimmed.slice(comma + 1);
  }
  trimmed = trimmed.replace(/\s/g, "");
  if (trimmed.toLowerCase().startsWith("base64:")) {
    trimmed = trimmed.slice(7);
  }
  return trimmed;
}

function decodeP12FromBase64(raw: string): Buffer | null {
  const trimmed = stripEnvQuotes(raw);
  if (trimmed.includes("-----BEGIN")) return null;

  const normalized = normalizeBase64CertInput(raw);
  if (!normalized || normalized.length < 64) return null;
  try {
    const buf = Buffer.from(normalized, "base64");
    // .p12 válido costuma ter pelo menos alguns KB; evita aceitar texto/path decodificado por engano.
    if (buf.length < 256) return null;
    return buf;
  } catch {
    return null;
  }
}

const EFI_PIX_CERT_BASE64_ENV_KEYS = [
  "EFI_PIX_CERT_BASE64",
  "EFI_CERTIFICATE_BASE64",
  "EFI_PIX_CERT",
  "EFI_CERTIFICATE",
  "EFI_PIX_CERT_PATH",
  "EFI_CERTIFICATE_PATH",
] as const;

function resolveCertPfxFromEnv(): { pfx: Buffer; cacheKey: string } | null {
  for (const key of EFI_PIX_CERT_BASE64_ENV_KEYS) {
    const raw = String(process.env[key] || "").trim();
    if (!raw) continue;

    const asPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    if (
      raw.length < 4096 &&
      (raw.endsWith(".p12") || raw.endsWith(".pfx")) &&
      fs.existsSync(asPath)
    ) {
      continue;
    }

    const pfx = decodeP12FromBase64(raw);
    if (pfx) return { pfx, cacheKey: `env:${key}` };
  }
  return null;
}

function resolveCertPathFromDisk(): string | null {
  for (const key of ["EFI_PIX_CERT_PATH", "EFI_CERTIFICATE_PATH"] as const) {
    const raw = String(process.env[key] || "").trim();
    if (!raw) continue;
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function resolvePixCertPfx(): { pfx: Buffer; cacheKey: string } | null {
  const fromEnv = resolveCertPfxFromEnv();
  if (fromEnv) return fromEnv;

  const certPath = resolveCertPathFromDisk();
  if (!certPath) return null;

  return { pfx: fs.readFileSync(certPath), cacheKey: `file:${certPath}` };
}

export type EfiPixSetupDiagnostics = {
  hasClientCredentials: boolean;
  hasPixKey: boolean;
  certEnvKeysPresent: string[];
  certResolved: boolean;
  certSource: string | null;
  issues: string[];
};

/** Diagnóstico seguro (sem expor segredos) — use quando pixAvailable for false. */
export function getEfiPixSetupDiagnostics(): EfiPixSetupDiagnostics {
  const hasClientCredentials = !!resolveEfiEnv();
  const hasPixKey = !!String(process.env.EFI_PIX_KEY || process.env.EFI_PIX_CHAVE || "").trim();
  const certEnvKeysPresent = EFI_PIX_CERT_BASE64_ENV_KEYS.filter((k) =>
    !!String(process.env[k] || "").trim()
  );
  const cert = resolvePixCertPfx();
  const issues: string[] = [];

  if (!hasClientCredentials) {
    issues.push("Defina EFI_CLIENT_ID e EFI_CLIENT_SECRET (Cobranças Efí).");
  }
  if (!hasPixKey) {
    issues.push("Defina EFI_PIX_KEY com a chave Pix da conta.");
  }
  if (!certEnvKeysPresent.length) {
    issues.push(
      "Defina EFI_PIX_CERT_BASE64 com o arquivo .p12 inteiro em Base64 (recomendado na Vercel)."
    );
  } else if (!cert) {
    const key = certEnvKeysPresent[0]!;
    const sample = stripEnvQuotes(String(process.env[key] || ""));
    if (sample.includes("-----BEGIN")) {
      issues.push(
        `${key}: formato PEM detectado. A API Pix exige certificado .p12 (PKCS#12), não .pem/.crt.`
      );
    } else if (sample.length < 200) {
      issues.push(
        `${key}: valor muito curto — cole o Base64 completo do .p12 (não o caminho do arquivo).`
      );
    } else {
      issues.push(
        `${key}: não foi possível decodificar o .p12. Gere o Base64 a partir do arquivo binário .p12.`
      );
    }
  }

  return {
    hasClientCredentials,
    hasPixKey,
    certEnvKeysPresent,
    certResolved: !!cert,
    certSource: cert?.cacheKey ?? null,
    issues,
  };
}

export function resolveEfiPixEnv(): EfiPixEnv | null {
  const cob = resolveEfiEnv();
  if (!cob) return null;

  const pixKey = String(process.env.EFI_PIX_KEY || process.env.EFI_PIX_CHAVE || "").trim();
  const cert = resolvePixCertPfx();
  if (!pixKey || !cert) return null;

  const baseUrl =
    String(process.env.EFI_PIX_API_BASE_URL || "").trim() ||
    (cob.sandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br");

  return {
    ...cob,
    baseUrl: baseUrl.replace(/\/$/, ""),
    pixKey,
    certPfx: cert.pfx,
    certCacheKey: cert.cacheKey,
    certPassphrase: String(process.env.EFI_PIX_CERT_PASSPHRASE || process.env.EFI_CERT_PASSPHRASE || ""),
  };
}

function getHttpsAgent(env: EfiPixEnv): https.Agent {
  const cacheKey = `${env.certCacheKey}:${env.certPassphrase}`;
  const existing = httpsAgentByCert.get(cacheKey);
  if (existing) return existing;

  const agent = new https.Agent({
    pfx: env.certPfx,
    passphrase: env.certPassphrase || undefined,
    rejectUnauthorized: true,
  });
  httpsAgentByCert.set(cacheKey, agent);
  return agent;
}

function pixClient(env: EfiPixEnv): AxiosInstance {
  return axios.create({
    baseURL: env.baseUrl,
    timeout: 25000,
    httpsAgent: getHttpsAgent(env),
    headers: { "Content-Type": "application/json" },
  });
}

export async function efiPixGetAccessToken(env: EfiPixEnv): Promise<string> {
  const now = Date.now();
  if (cachedPixToken && cachedPixToken.expiresAt > now + 60_000) {
    return cachedPixToken.token;
  }

  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const client = pixClient(env);
  const { data } = await client.post(
    "/oauth/token",
    { grant_type: "client_credentials" },
    { headers: { Authorization: `Basic ${basic}` } }
  );

  const token = String(data?.access_token || "");
  if (!token) throw new Error("EFI Pix: access_token ausente na autorização");

  const expiresIn = Number(data?.expires_in || 3600);
  cachedPixToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

export type EfiPixChargeInput = {
  tenantId: string;
  amountCents: number;
  payerName: string;
  payerCpf?: string;
  description?: string;
  expirationSeconds?: number;
};

export type EfiPixChargeResult = {
  txid: string;
  copyPaste: string;
  status: string;
  location?: string;
  raw: unknown;
};

export async function efiPixCreateImmediateCharge(
  env: EfiPixEnv,
  input: EfiPixChargeInput
): Promise<EfiPixChargeResult> {
  const token = await efiPixGetAccessToken(env);
  const client = pixClient(env);

  const valorOriginal = (input.amountCents / 100).toFixed(2);
  const body: Record<string, unknown> = {
    calendario: { expiracao: input.expirationSeconds ?? 3600 },
    valor: { original: valorOriginal },
    chave: env.pixKey,
    solicitacaoPagador: input.description || "Assinatura AxéCloud Premium",
    infoAdicionais: [
      { nome: "tenant_id", valor: input.tenantId.slice(0, 50) },
    ],
  };

  const cpf = String(input.payerCpf || "").replace(/\D/g, "");
  if (cpf.length === 11) {
    body.devedor = { cpf, nome: input.payerName.slice(0, 200) };
  }

  const { data } = await client.post("/v2/cob", body, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const txid = String(data?.txid || "");
  const copyPaste = String(data?.pixCopiaECola || "");
  if (!txid || !copyPaste) {
    throw new Error("EFI Pix: resposta de cobrança incompleta (txid ou pixCopiaECola ausente)");
  }

  return {
    txid,
    copyPaste,
    status: String(data?.status || "ATIVA"),
    location: data?.location ? String(data.location) : undefined,
    raw: data,
  };
}

export async function efiPixGetCob(env: EfiPixEnv, txid: string): Promise<{
  status: string;
  paid: boolean;
  raw: unknown;
}> {
  const token = await efiPixGetAccessToken(env);
  const client = pixClient(env);
  const { data } = await client.get(`/v2/cob/${encodeURIComponent(txid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const status = String(data?.status || "").toUpperCase();
  const paid = status === "CONCLUIDA";

  return { status, paid, raw: data };
}
