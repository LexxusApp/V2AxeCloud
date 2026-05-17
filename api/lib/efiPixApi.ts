import fs from "fs";
import https from "https";
import path from "path";
import axios, { type AxiosInstance } from "axios";
import { resolveEfiEnv, type EfiEnv } from "./efiPay.js";

export type EfiPixEnv = EfiEnv & {
  baseUrl: string;
  pixKey: string;
  certPath: string;
  certPassphrase: string;
};

let cachedPixToken: { token: string; expiresAt: number } | null = null;
const httpsAgentByCert = new Map<string, https.Agent>();

function resolveCertPath(): string | null {
  const candidates = [
    process.env.EFI_PIX_CERT_PATH,
    process.env.EFI_CERTIFICATE_PATH,
    process.env.EFI_PIX_CERT,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  for (const raw of candidates) {
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

export function resolveEfiPixEnv(): EfiPixEnv | null {
  const cob = resolveEfiEnv();
  if (!cob) return null;

  const pixKey = String(process.env.EFI_PIX_KEY || process.env.EFI_PIX_CHAVE || "").trim();
  const certPath = resolveCertPath();
  if (!pixKey || !certPath) return null;

  const baseUrl =
    String(process.env.EFI_PIX_API_BASE_URL || "").trim() ||
    (cob.sandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br");

  return {
    ...cob,
    baseUrl: baseUrl.replace(/\/$/, ""),
    pixKey,
    certPath,
    certPassphrase: String(process.env.EFI_PIX_CERT_PASSPHRASE || process.env.EFI_CERT_PASSPHRASE || ""),
  };
}

function getHttpsAgent(env: EfiPixEnv): https.Agent {
  const cacheKey = `${env.certPath}:${env.certPassphrase}`;
  const existing = httpsAgentByCert.get(cacheKey);
  if (existing) return existing;

  const pfx = fs.readFileSync(env.certPath);
  const agent = new https.Agent({
    pfx,
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
