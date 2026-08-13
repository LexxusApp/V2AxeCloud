import assert from "node:assert/strict";
import test from "node:test";
import { htmlToAgentMarkdown } from "../scripts/htmlToAgentMarkdown.mjs";

test("converte HTML público em Markdown com frontmatter e sem chrome", () => {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <title>Gestão de terreiros | AxéCloud</title>
  <meta name="description" content="Software brasileiro de gestão de terreiros." />
  <meta property="og:image" content="https://axecloud.com.br/og-image.png" />
  <script type="application/ld+json">{"@type":"Organization","name":"AxéCloud"}</script>
</head>
<body>
  <header><nav><a href="/entrar">Entrar</a></nav></header>
  <script>window.track=1</script>
  <main>
    <h1>Gestão de terreiros</h1>
    <p>O <strong>AxéCloud</strong> organiza <a href="/recursos">módulos</a> da casa.</p>
    <ul><li>Pix</li><li>Calendário</li></ul>
  </main>
  <footer>rodapé</footer>
</body>
</html>`;

  const markdown = htmlToAgentMarkdown(html, "https://axecloud.com.br/");

  assert.match(markdown, /^---\n/);
  assert.match(markdown, /title: .+/);
  assert.match(markdown, /description: "Software brasileiro de gestão de terreiros\."/);
  assert.match(markdown, /# Gestão de terreiros \| AxéCloud/);
  assert.match(markdown, /\[módulos\]\(https:\/\/axecloud\.com\.br\/recursos\)/);
  assert.match(markdown, /- Pix/);
  assert.match(markdown, /```json/);
  assert.doesNotMatch(markdown, /<script/);
  assert.doesNotMatch(markdown, /Entrar/);
  assert.doesNotMatch(markdown, /rodapé/);
  assert.doesNotMatch(markdown, /window\.track/);
});
