import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 4399;
const origin = `http://127.0.0.1:${port}`;
let server;

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${origin}/`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Servidor de teste não iniciou: ${String(lastError || "timeout")}`);
}

before(async () => {
  server = spawn(process.execPath, [
    path.join(root, "node_modules", "vinext", "dist", "cli.js"),
    "start", "--hostname", "127.0.0.1", "--port", String(port),
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  await waitForServer();
});

after(() => {
  server?.kill();
});

async function get(pathname) {
  const response = await fetch(`${origin}${pathname}`);
  return { response, text: await response.text() };
}

test("home entrega SEO, conteúdo e imagens estáveis", async () => {
  const { response, text } = await get("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/html/i);
  assert.match(text, /<html[^>]+lang="pt-BR"/i);
  assert.match(text, /<title>Gestão de Terreiros \| AxéCloud para Umbanda e Candomblé<\/title>/i);
  assert.match(text, /<meta[^>]+name="description"[^>]+Sistema de gestão para terreiros/i);
  assert.match(text, /<link[^>]+rel="canonical"[^>]+href="https:\/\/axecloud\.com\.br\/"/i);
  assert.equal((text.match(/<h1[\s>]/gi) || []).length, 1);
  assert.match(text, /Menos burocracia/);
  assert.match(text, /Mais tempo para cuidar da casa/);
  assert.match(text, />69,90<\/strong><small>por mês<\/small>/);
  assert.match(text, /Testar grátis por 30 dias/);
  assert.match(text, /<article[^>]+class="cx-offer cx-reveal"[^>]+id="plano"/i);
  assert.doesNotMatch(text, /<section[^>]+id="plano"[^>]+class="cx-finale"/i);
  assert.match(text, /TELAS ATUAIS · CAPTURADAS NO SISTEMA REAL/);
  assert.match(text, /PERGUNTAS FREQUENTES/);
  assert.match(text, /"@type":"Organization"/);
  assert.match(text, /"@type":"SoftwareApplication"/);
  assert.match(text, /"@type":"FAQPage"/);
  assert.match(text, /<img[^>]+width="1440"[^>]+height="900"/i);
});

test("login possui metadados próprios", async () => {
  const { response, text } = await get("/entrar");
  assert.equal(response.status, 200);
  assert.match(text, /<title>Entrar \| AxéCloud<\/title>/i);
  assert.match(text, /<link[^>]+rel="canonical"[^>]+href="https:\/\/axecloud\.com\.br\/entrar"/i);
  assert.match(text, /<meta[^>]+name="robots"[^>]+content="noindex, follow"/i);
  assert.match(text, /Quem está entrando\?/);
});

test("guias são rastreáveis, mas não indexáveis", async () => {
  for (const pathname of ["/instrucoes", "/instrucoes/membro"]) {
    const { response, text } = await get(pathname);
    assert.equal(response.status, 200);
    assert.match(text, /<meta[^>]+name="robots"[^>]+content="noindex, follow"/i);
    assert.match(text, new RegExp(`href="https:\\/\\/axecloud\\.com\\.br${pathname.replaceAll("/", "\\/")}"`, "i"));
  }
});

test("arquivos de descoberta estão disponíveis", async () => {
  const robots = await get("/robots.txt");
  assert.equal(robots.response.status, 200);
  assert.match(robots.text, /Content-Signal: search=yes, ai-input=yes, ai-train=no/);
  assert.match(robots.text, /Sitemap: https:\/\/axecloud\.com\.br\/sitemap\.xml/);

  const llms = await get("/llms.txt");
  assert.equal(llms.response.status, 200);
  assert.match(llms.text, /^# AxéCloud/m);

  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert.match(sitemap.response.headers.get("content-type") || "", /xml/i);
  assert.match(sitemap.text, /https:\/\/axecloud\.com\.br\/terreiros/);
  assert.doesNotMatch(sitemap.text, /\/instrucoes/);
  assert.doesNotMatch(sitemap.text, /\/entrar/);
});
