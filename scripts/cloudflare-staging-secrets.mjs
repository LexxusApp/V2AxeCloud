import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const [sourceEnvPath, efiCertificatePath] = process.argv.slice(2);
if (!sourceEnvPath || !efiCertificatePath) {
  console.error("Usage: node scripts/cloudflare-staging-secrets.mjs ENV_FILE EFI_P12_FILE");
  process.exit(2);
}

const excluded = new Set([
  "ACME_EMAIL",
  "B2_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_NAME",
  "CROWDSEC_CADDY_API_KEY",
  "EFI_CERTIFICATE_PATH",
  "EVOLUTION_API_BASE_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_AUTOPOST_INSTANCE",
  "EVOLUTION_AUTOPOST_INTEGRATION",
  "EVOLUTION_DB_PASSWORD",
  "EVOLUTION_SERVER_URL",
  "NODE_ENV",
]);

const parsed = dotenv.parse(readFileSync(sourceEnvPath));
const secrets = Object.fromEntries(
  Object.entries(parsed).filter(([name, value]) => !excluded.has(name) && value.length > 0),
);
secrets.EFI_PIX_CERT_BASE64 = readFileSync(efiCertificatePath).toString("base64");
secrets.NODE_OPTIONS = "--openssl-legacy-provider";
secrets.TRUST_PROXY_CLIENT_IP = "1";

for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!secrets[name]) throw new Error(`Required API setting missing: ${name}`);
}
if (Object.keys(secrets).length > 100) throw new Error("Cloudflare bulk secret limit exceeded");

console.log(`Uploading ${Object.keys(secrets).length} named settings to axecloud-api-staging; values are not logged.`);
if (process.argv.includes("--check")) process.exit(0);
const wrangler = spawn(
  "npx",
  ["--yes", "wrangler@4.136.1", "secret", "bulk", "--config", "wrangler.api-container.jsonc"],
  { stdio: ["pipe", "inherit", "inherit"], env: process.env },
);
wrangler.stdin.end(JSON.stringify(secrets));
wrangler.on("error", (error) => {
  console.error("Could not start Wrangler:", error.message);
  process.exitCode = 1;
});
wrangler.on("close", (code) => {
  process.exitCode = code ?? 1;
});