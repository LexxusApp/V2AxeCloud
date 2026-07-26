import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateSecureAccessPassword } from "../api/lib/accessPassword.ts";
import { resolveClientIp } from "../api/lib/clientIp.ts";
import { assertSafeImageBuffer } from "../api/lib/imageUpload.ts";
import { isAllowedGalleryMime } from "../api/lib/mediaUpload.ts";
import { assertSafeExternalUrl } from "../api/lib/ssrfGuard.ts";
import { isConsoleGlobalAdmin } from "../api/lib/consoleAdmin.ts";
import { rawBodyForSignature } from "../api/lib/rawBody.ts";
import { verifyMetaWebhookSignature } from "../api/lib/whatsappMetaWebhook.ts";

test("IP encaminhado pelo cliente não suplanta o endereço do proxy", () => {
  const oldTrust = process.env.TRUST_PROXY_CLIENT_IP;
  const oldVercel = process.env.VERCEL;
  delete process.env.TRUST_PROXY_CLIENT_IP;
  delete process.env.VERCEL;
  const request = {
    headers: { "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" },
    socket: { remoteAddress: "203.0.113.20" },
  };
  assert.equal(resolveClientIp(request), "203.0.113.20");
  process.env.TRUST_PROXY_CLIENT_IP = "1";
  request.headers["x-axecloud-client-ip" as keyof typeof request.headers] = "198.51.100.9";
  assert.equal(resolveClientIp(request), "198.51.100.9");
  if (oldTrust === undefined) delete process.env.TRUST_PROXY_CLIENT_IP;
  else process.env.TRUST_PROXY_CLIENT_IP = oldTrust;
  if (oldVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = oldVercel;
});

test("senhas temporárias usam CSPRNG e todas as classes obrigatórias", () => {
  const generated = new Set(Array.from({ length: 32 }, () => generateSecureAccessPassword()));
  assert.equal(generated.size, 32);
  for (const password of generated) {
    assert.match(password, /[a-z]/);
    assert.match(password, /[A-Z]/);
    assert.match(password, /\d/);
    assert.match(password, /[^A-Za-z0-9]/);
    assert.ok(password.length >= 12);
  }
});

test("upload de imagem valida assinatura e bloqueia SVG/disfarce de MIME", () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  assert.equal(assertSafeImageBuffer(png, "image/png"), "image/png");
  assert.throws(() => assertSafeImageBuffer(Buffer.from("<svg><script/></svg>"), "image/svg+xml"));
  assert.throws(() => assertSafeImageBuffer(png, "image/jpeg"));
  assert.equal(isAllowedGalleryMime("image/svg+xml"), false);
  assert.equal(isAllowedGalleryMime("video/mp4"), true);
});

test("guarda SSRF rejeita loopback, credenciais na URL e protocolos não HTTP", async () => {
  await assert.rejects(() => assertSafeExternalUrl("http://127.0.0.1/admin"));
  await assert.rejects(() => assertSafeExternalUrl("https://user:pass@example.com"));
  await assert.rejects(() => assertSafeExternalUrl("file:///etc/passwd"));
});

test("fontes críticas não reintroduzem JWT sem assinatura nem coletores de debug", () => {
  const sources = [
    readFileSync("api/index.ts", "utf8"),
    readFileSync("server.ts", "utf8"),
    readFileSync("src/views/Calendar.tsx", "utf8"),
    readFileSync("axecloud-admin/src/lib/api.ts", "utf8"),
  ].join("\n");
  assert.doesNotMatch(sources, /admin\.getUserById\s*\(\s*payload\.sub/);
  assert.doesNotMatch(sources, /Buffer\.from\s*\(\s*token\.split\([^)]*\)\[1\]/);
  assert.doesNotMatch(sources, /127\.0\.0\.1:7242|localhost:7242|ingest\/.*debug/i);
});

test("admin global não é herdado de outro perfil por coincidência de e-mail", async () => {
  const oldConsole = process.env.ADMIN_CONSOLE_EMAILS;
  const oldAdmin = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_CONSOLE_EMAILS;
  delete process.env.ADMIN_EMAILS;
  let emailLookupAttempted = false;
  const fakeSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        ilike: () => {
          emailLookupAttempted = true;
          throw new Error("consulta por e-mail proibida");
        },
      }),
    }),
  };
  assert.equal(
    await isConsoleGlobalAdmin(fakeSupabase, { id: "novo-uuid", email: "email-antigo@admin.test" }),
    false
  );
  assert.equal(emailLookupAttempted, false);
  if (oldConsole === undefined) delete process.env.ADMIN_CONSOLE_EMAILS;
  else process.env.ADMIN_CONSOLE_EMAILS = oldConsole;
  if (oldAdmin === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = oldAdmin;
});

test("webhook Meta falha fechado sem segredo ou sem corpo bruto", () => {
  const oldWaSecret = process.env.WA_META_APP_SECRET;
  const oldMetaSecret = process.env.META_APP_SECRET;
  delete process.env.WA_META_APP_SECRET;
  delete process.env.META_APP_SECRET;

  const body = Buffer.from('{"object":"whatsapp_business_account"}', "utf8");
  assert.equal(verifyMetaWebhookSignature(body, "sha256=invalid"), false);

  process.env.WA_META_APP_SECRET = "test-only-meta-secret";
  const signature = `sha256=${createHmac("sha256", process.env.WA_META_APP_SECRET).update(body).digest("hex")}`;
  assert.equal(verifyMetaWebhookSignature(body, signature), true);
  assert.equal(verifyMetaWebhookSignature(undefined, signature), false);
  assert.equal(rawBodyForSignature({} as never), undefined);
  assert.deepEqual(rawBodyForSignature({ rawBody: body } as never), body);

  if (oldWaSecret === undefined) delete process.env.WA_META_APP_SECRET;
  else process.env.WA_META_APP_SECRET = oldWaSecret;
  if (oldMetaSecret === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = oldMetaSecret;
});

test("aliases do webhook Meta compartilham o mesmo handler autenticado", () => {
  for (const path of ["api/index.ts", "server.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /app\.post\(\["\/api\/whatsapp\/webhook", "\/webhook\/meta"\]/);
    assert.match(source, /app\.get\(\["\/api\/whatsapp\/webhook", "\/webhook\/meta"\]/);
    assert.doesNotMatch(source, /app\.post\("\/webhook\/meta"/);
  }
});

test("mutações públicas sensíveis usam limitadores restritivos", () => {
  const gira = readFileSync("api/lib/giraOperationsRoutes.ts", "utf8");
  const portal = readFileSync("api/lib/publicPortalRoutes.ts", "utf8");
  assert.match(gira, /publicConfirmationRateLimit/);
  assert.match(gira, /publicTicketIssueRateLimit/);
  assert.match(portal, /publicTicketIssueRateLimit/);
  assert.doesNotMatch(
    gira,
    /app\.post\("\/api\/v1\/public\/(?:checkin|presenca|senhas)[^"]*", apiReadRateLimit/
  );
  assert.doesNotMatch(
    portal,
    /app\.post\("\/api\/v1\/public\/evento\/:token\/emitir-senha", apiReadRateLimit/
  );
});

test("OTP de recuperação é persistido, protegido e consumido uma única vez", () => {
  const source = readFileSync("api/lib/forgotPasswordWhatsappRoutes.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260726123000_password_reset_whatsapp_otp.sql",
    "utf8"
  );
  assert.doesNotMatch(source, /new Map<string, OtpEntry>/);
  assert.match(source, /createHmac\("sha256"/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /\.from\("password_reset_whatsapp_otp"\)/);
  assert.match(source, /\.delete\(\)[\s\S]*\.eq\("code_hash", entry\.code_hash\)/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* anon, authenticated/i);
  assert.match(migration, /grant all .* service_role/i);
});

test("disparo manual de evento exige autenticação, autorização e limite de broadcast", () => {
  const source = readFileSync("api/lib/eventNotificationRoutes.ts", "utf8");
  assert.match(source, /whatsappBroadcastRateLimit/);
  assert.match(source, /requireApiUser/);
  assert.match(source, /userCanModifyCalendarEvent/);
  assert.match(source, /isSubscriptionAccessActive/);
});
