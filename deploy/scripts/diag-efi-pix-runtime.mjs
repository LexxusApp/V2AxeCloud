#!/usr/bin/env node
/** Diagnóstico EFI Pix no container — sem imprimir segredos. */
import fs from "fs";
import https from "https";
import crypto from "crypto";

const path = "/run/secrets/efi-certificate.p12";
const exists = fs.existsSync(path);
const size = exists ? fs.statSync(path).size : 0;
const sandbox = String(process.env.EFI_SANDBOX || "");
const passphrase = String(
  process.env.EFI_PIX_CERT_PASSPHRASE || process.env.EFI_CERT_PASSPHRASE || ""
);
const pixKeyLen = String(process.env.EFI_PIX_KEY || process.env.EFI_PIX_CHAVE || "").trim()
  .length;
const hasId = !!String(process.env.EFI_CLIENT_ID || "").trim();
const hasSec = !!String(process.env.EFI_CLIENT_SECRET || "").trim();
const base =
  String(process.env.EFI_PIX_API_BASE_URL || "").trim() ||
  (sandbox === "true" || sandbox === "1"
    ? "https://pix-h.api.efipay.com.br"
    : "https://pix.api.efipay.com.br");

const out = {
  exists,
  size,
  sandbox,
  nodeEnv: process.env.NODE_ENV || "",
  openssl: process.versions.openssl,
  hasId,
  hasSec,
  pixKeyLen,
  hasPassphrase: !!passphrase,
  base,
};

if (exists) {
  const pfx = fs.readFileSync(path);
  try {
    // Node 22 / OpenSSL 3: p12 antigo pode falhar sem legacy provider
    crypto.createPrivateKey({ key: pfx, format: "pfx", passphrase });
    out.pfxReadable = true;
  } catch (e) {
    out.pfxReadable = false;
    out.pfxError = String(e?.message || e).slice(0, 180);
  }

  const tryOauth = (label, agentOpts) =>
    new Promise((resolve) => {
      if (!hasId || !hasSec) {
        resolve({ label, skipped: true });
        return;
      }
      const agent = new https.Agent({
        pfx,
        passphrase: passphrase || undefined,
        rejectUnauthorized: true,
        keepAlive: false,
        ...agentOpts,
      });
      const basic = Buffer.from(
        `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
      ).toString("base64");
      const body = JSON.stringify({ grant_type: "client_credentials" });
      const req = https.request(
        `${base}/oauth/token`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          agent,
        },
        (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () => {
            const response = (() => {
              try {
                return JSON.parse(d);
              } catch {
                return {};
              }
            })();
            resolve({
              label,
              status: res.statusCode,
              hasAccessToken: Boolean(response.access_token),
              error: response.error || null,
              errorDescription: response.error_description || null,
            });
          });
        }
      );
      req.setTimeout(20000, () => {
        req.destroy(new Error("timeout"));
      });
      req.on("error", (e) => {
        resolve({
          label,
          error: e.message,
          code: e.code || null,
        });
      });
      req.write(body);
      req.end();
    });

  out.oauth = [];
  out.oauth.push(await tryOauth("default", {}));
  out.oauth.push(
    await tryOauth("tls12", { minVersion: "TLSv1.2", maxVersion: "TLSv1.2" })
  );
  out.oauth.push(
    await tryOauth("tls12-13", { minVersion: "TLSv1.2", maxVersion: "TLSv1.3" })
  );
}

console.log(JSON.stringify(out, null, 2));
