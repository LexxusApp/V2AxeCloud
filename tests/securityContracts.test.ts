import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateSecureAccessPassword } from "../api/lib/accessPassword.ts";
import { resolveClientIp } from "../api/lib/clientIp.ts";
import { assertSafeImageBuffer } from "../api/lib/imageUpload.ts";
import { isAllowedGalleryMime } from "../api/lib/mediaUpload.ts";
import { assertSafeExternalUrl } from "../api/lib/ssrfGuard.ts";
import { isConsoleGlobalAdmin } from "../api/lib/consoleAdmin.ts";

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
