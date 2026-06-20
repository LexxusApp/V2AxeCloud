import fs from "fs";
import https from "https";
import path from "path";
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

export type SantanderPixEnv = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  baseUrl: string;
  pixKey: string;
  workspaceId: string;
  certCrt: Buffer;
  certKey: Buffer;
  certCacheKey: string;
  pixCobPath: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;
const httpsAgentByCert = new Map<string, https.Agent>();

const DEFAULT_CERT_DIR = path.join("certs", "santander-sandbox");
const DEFAULT_CERT_CRT = path.join(DEFAULT_CERT_DIR, "santander-sandbox.crt");
const DEFAULT_CERT_KEY = path.join(DEFAULT_CERT_DIR, "santander-sandbox.key");

function stripEnvQuotes(value: string): string {
  const t = value.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function resolveFilePath(raw: string): string {
  const trimmed = stripEnvQuotes(raw);
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
}

function readPemFile(raw: string): Buffer | null {
  const resolved = resolveFilePath(raw);
  if (!fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved);
}

function decodePemFromBase64(raw: string): Buffer | null {
  const trimmed = stripEnvQuotes(raw);
  if (trimmed.includes("-----BEGIN")) {
    return Buffer.from(trimmed, "utf8");
  }

  const normalized = trimmed.replace(/\s/g, "");
  if (!normalized || normalized.length < 64) return null;
  try {
    const buf = Buffer.from(normalized, "base64");
    if (buf.length < 128) return null;
    return buf;
  } catch {
    return null;
  }
}

type PemPair = { cert: Buffer; key: Buffer; cacheKey: string };

function resolvePemPair(): PemPair | null {
  const crtFromEnv =
    String(process.env.SANTANDER_CERT_CRT_PATH || process.env.SANTANDER_CERT_PATH || "").trim() ||
    DEFAULT_CERT_CRT;
  const keyFromEnv =
    String(process.env.SANTANDER_CERT_KEY_PATH || process.env.SANTANDER_KEY_PATH || "").trim() ||
    DEFAULT_CERT_KEY;

  const crtB64 = String(process.env.SANTANDER_CERT_CRT_BASE64 || process.env.SANTANDER_CERT_BASE64 || "").trim();
  const keyB64 = String(process.env.SANTANDER_CERT_KEY_BASE64 || process.env.SANTANDER_KEY_BASE64 || "").trim();

  let cert: Buffer | null = null;
  let key: Buffer | null = null;
  let cacheKey = "";

  if (crtB64) {
    cert = decodePemFromBase64(crtB64);
    cacheKey = "env:SANTANDER_CERT_CRT_BASE64";
  } else {
    cert = readPemFile(crtFromEnv);
    if (cert) cacheKey = `file:${resolveFilePath(crtFromEnv)}`;
  }

  if (keyB64) {
    key = decodePemFromBase64(keyB64);
    cacheKey = cacheKey ? `${cacheKey}+env:SANTANDER_CERT_KEY_BASE64` : "env:SANTANDER_CERT_KEY_BASE64";
  } else {
    key = readPemFile(keyFromEnv);
    if (key) {
      cacheKey = cacheKey ? `${cacheKey}+file:${resolveFilePath(keyFromEnv)}` : `file:${resolveFilePath(keyFromEnv)}`;
    }
  }

  if (!cert || !key) return null;
  return { cert, key, cacheKey };
}

export type SantanderPixSetupDiagnostics = {
  hasClientCredentials: boolean;
  hasPixKey: boolean;
  hasWorkspaceId: boolean;
  certResolved: boolean;
  certSource: string | null;
  certCrtPath: string;
  certKeyPath: string;
  baseUrl: string;
  issues: string[];
};

export function getSantanderPixSetupDiagnostics(): SantanderPixSetupDiagnostics {
  const clientId = String(process.env.SANTANDER_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.SANTANDER_CLIENT_SECRET || "").trim();
  const pixKey = String(process.env.SANTANDER_PIX_KEY || process.env.SANTANDER_CHAVE_PIX || "").trim();
  const workspaceId = String(process.env.SANTANDER_WORKSPACE_ID || "").trim();
  const cert = resolvePemPair();

  const certCrtPath = resolveFilePath(
    String(process.env.SANTANDER_CERT_CRT_PATH || process.env.SANTANDER_CERT_PATH || "").trim() ||
      DEFAULT_CERT_CRT
  );
  const certKeyPath = resolveFilePath(
    String(process.env.SANTANDER_CERT_KEY_PATH || process.env.SANTANDER_KEY_PATH || "").trim() ||
      DEFAULT_CERT_KEY
  );

  const sandbox =
    process.env.SANTANDER_SANDBOX === "true" ||
    process.env.SANTANDER_SANDBOX === "1" ||
    (process.env.SANTANDER_SANDBOX !== "false" && process.env.NODE_ENV !== "production");

  const baseUrl =
    String(process.env.SANTANDER_API_BASE_URL || "").trim() ||
    (sandbox ? "https://trust-sandbox.api.santander.com.br" : "https://trust-open.api.santander.com.br");

  const issues: string[] = [];
  if (!clientId || !clientSecret) {
    issues.push("Defina SANTANDER_CLIENT_ID e SANTANDER_CLIENT_SECRET (portal developer.santander.com.br).");
  }
  if (!pixKey) {
    issues.push("Defina SANTANDER_PIX_KEY com a chave Pix vinculada à conta.");
  }
  if (!workspaceId) {
    issues.push("Defina SANTANDER_WORKSPACE_ID após criar o workspace no portal.");
  }
  if (!cert) {
    issues.push(
      `Certificado mTLS não encontrado. Gere ${DEFAULT_CERT_CRT} e ${DEFAULT_CERT_KEY} (ou defina SANTANDER_CERT_CRT_PATH / SANTANDER_CERT_KEY_PATH).`
    );
  }

  return {
    hasClientCredentials: !!clientId && !!clientSecret,
    hasPixKey: !!pixKey,
    hasWorkspaceId: !!workspaceId,
    certResolved: !!cert,
    certSource: cert?.cacheKey ?? null,
    certCrtPath,
    certKeyPath,
    baseUrl: baseUrl.replace(/\/$/, ""),
    issues,
  };
}

export function resolveSantanderPixEnv(): SantanderPixEnv | null {
  const clientId = String(process.env.SANTANDER_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.SANTANDER_CLIENT_SECRET || "").trim();
  const pixKey = String(process.env.SANTANDER_PIX_KEY || process.env.SANTANDER_CHAVE_PIX || "").trim();
  const workspaceId = String(process.env.SANTANDER_WORKSPACE_ID || "").trim();
  const cert = resolvePemPair();

  if (!clientId || !clientSecret || !pixKey || !workspaceId || !cert) return null;

  const sandbox =
    process.env.SANTANDER_SANDBOX === "true" ||
    process.env.SANTANDER_SANDBOX === "1" ||
    (process.env.SANTANDER_SANDBOX !== "false" && process.env.NODE_ENV !== "production");

  const baseUrl =
    String(process.env.SANTANDER_API_BASE_URL || "").trim() ||
    (sandbox ? "https://trust-sandbox.api.santander.com.br" : "https://trust-open.api.santander.com.br");

  const pixCobPath =
    String(process.env.SANTANDER_PIX_COBRANCA_PATH || "").trim() ||
    `/management_payments_partners/v1/workspaces/${encodeURIComponent(workspaceId)}/pix_qrcodes`;

  return {
    clientId,
    clientSecret,
    sandbox,
    baseUrl: baseUrl.replace(/\/$/, ""),
    pixKey,
    workspaceId,
    certCrt: cert.cert,
    certKey: cert.key,
    certCacheKey: cert.cacheKey,
    pixCobPath,
  };
}

function getHttpsAgent(env: SantanderPixEnv): https.Agent {
  const existing = httpsAgentByCert.get(env.certCacheKey);
  if (existing) return existing;

  const agent = new https.Agent({
    cert: env.certCrt,
    key: env.certKey,
    rejectUnauthorized: true,
  });
  httpsAgentByCert.set(env.certCacheKey, agent);
  return agent;
}

function santanderClient(env: SantanderPixEnv): AxiosInstance {
  return axios.create({
    baseURL: env.baseUrl,
    timeout: 30_000,
    httpsAgent: getHttpsAgent(env),
    headers: { "Content-Type": "application/json" },
  });
}

export async function santanderGetAccessToken(env: SantanderPixEnv): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const client = santanderClient(env);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.clientId,
    client_secret: env.clientSecret,
  });

  const { data } = await client.post("/auth/oauth/v2/token", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const token = String(data?.access_token || "");
  if (!token) throw new Error("Santander Pix: access_token ausente na autorização OAuth");

  const expiresIn = Number(data?.expires_in || 3600);
  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

export async function santanderPixRequest<T = unknown>(
  env: SantanderPixEnv,
  config: AxiosRequestConfig
): Promise<T> {
  const token = await santanderGetAccessToken(env);
  const client = santanderClient(env);
  const { data } = await client.request<T>({
    ...config,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Application-Key": env.clientId,
      ...(config.headers || {}),
    },
  });
  return data;
}

export type SantanderPixChargeInput = {
  tenantId: string;
  amountCents: number;
  payerName: string;
  payerDocument?: string;
  description?: string;
  expirationSeconds?: number;
  txid?: string;
};

export type SantanderPixChargeResult = {
  txid: string;
  copyPaste: string;
  qrCodeImage?: string;
  status: string;
  raw: unknown;
};

function buildTxid(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const suffix = Date.now().toString(36);
  return `${base}${suffix}`.slice(0, 35).padEnd(26, "0").slice(0, 35);
}

/** Cria cobrança Pix com QR Code dinâmico (ajuste o path via SANTANDER_PIX_COBRANCA_PATH se o portal indicar outro). */
export async function santanderPixCreateDynamicQrCode(
  env: SantanderPixEnv,
  input: SantanderPixChargeInput
): Promise<SantanderPixChargeResult> {
  const txid = input.txid || buildTxid(input.tenantId);
  const valor = (input.amountCents / 100).toFixed(2);
  const doc = String(input.payerDocument || "").replace(/\D/g, "");

  const body: Record<string, unknown> = {
    txid,
    calendario: { expiracao: input.expirationSeconds ?? 3600 },
    valor: { original: valor },
    chave: env.pixKey,
    solicitacaoPagador: input.description || "Pagamento AxéCloud",
    infoAdicionais: [{ nome: "tenant_id", valor: input.tenantId.slice(0, 50) }],
  };

  if (doc.length === 11) {
    body.devedor = { cpf: doc, nome: input.payerName.slice(0, 200) };
  } else if (doc.length === 14) {
    body.devedor = { cnpj: doc, nome: input.payerName.slice(0, 200) };
  }

  const data = await santanderPixRequest<Record<string, unknown>>(env, {
    method: "POST",
    url: env.pixCobPath,
    data: body,
  });

  const copyPaste = String(
    data?.pixCopiaECola || data?.emv || data?.qrCode || data?.qrcode || ""
  );
  const resolvedTxid = String(data?.txid || txid);

  if (!copyPaste) {
    throw new Error("Santander Pix: resposta sem pixCopiaECola/emv/qrcode");
  }

  return {
    txid: resolvedTxid,
    copyPaste,
    qrCodeImage: data?.qrCodeImage ? String(data.qrCodeImage) : undefined,
    status: String(data?.status || "ATIVA"),
    raw: data,
  };
}

export async function santanderPixGetCharge(
  env: SantanderPixEnv,
  txid: string
): Promise<{ status: string; paid: boolean; raw: unknown }> {
  const pathSuffix = env.pixCobPath.replace(/\/$/, "");
  const data = await santanderPixRequest<Record<string, unknown>>(env, {
    method: "GET",
    url: `${pathSuffix}/${encodeURIComponent(txid)}`,
  });

  const status = String(data?.status || "").toUpperCase();
  const paid = status === "CONCLUIDA" || status === "PAGO" || status === "PAID";
  return { status, paid, raw: data };
}
