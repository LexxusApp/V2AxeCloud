import { chromium } from "playwright";
import fs from "fs";

const email = process.env.AXECLOUD_E2E_EMAIL?.trim();
const password = process.env.AXECLOUD_E2E_PASSWORD;
const baseUrl = "https://axecloud.com.br";

if (!email || !password) {
  throw new Error("Defina AXECLOUD_E2E_EMAIL e AXECLOUD_E2E_PASSWORD no ambiente seguro de testes.");
}

const outputDir = "artifacts/live-prod-verify";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Iniciando verificação da Dashboard em produção na Cloudflare...");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();

try {
  console.log("Acessando login...");
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click Sou zelador
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(1000);

  const emailInput = page.getByPlaceholder("Digite seu e-mail");
  const passwordInput = page.getByPlaceholder("Digite sua senha");
  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitBtn = page.getByRole("button", { name: /entrar na gestão/i }).first();
  if (await submitBtn.count()) {
    await submitBtn.click();
  } else {
    await passwordInput.press("Enter");
  }

  console.log("Aguardando login...");
  await page.waitForTimeout(8000);

  console.log("Navegando explicitamente para /dashboard com cache bypass...");
  await page.goto(`${baseUrl}/dashboard?v=${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  console.log("URL atual:", page.url());
  
  // Desktop screenshot
  const desktopShot = `${outputDir}/prod-dashboard-desktop.png`;
  await page.screenshot({ path: desktopShot, fullPage: true });
  console.log("Screenshot desktop salvo em:", desktopShot);

  // Mobile screenshot
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(2000);
  const mobileShot = `${outputDir}/prod-dashboard-mobile.png`;
  await page.screenshot({ path: mobileShot, fullPage: true });
  console.log("Screenshot mobile salvo em:", mobileShot);

  // Check texts
  const pageText = await page.innerText("body");
  const hasCerimonial = pageText.includes("Próximo Trabalho") || pageText.includes("Próximo trabalho") || pageText.includes("Gira");
  const hasCorrente = pageText.includes("Corrente ativa") || pageText.includes("Filhos");
  const hasCaixinha = pageText.includes("Caixinha OK") || pageText.includes("Financeiro");
  console.log("Verificações:", { hasCerimonial, hasCorrente, hasCaixinha });

} catch (err) {
  console.error("Erro na verificação:", err);
} finally {
  await browser.close();
  console.log("Verificação finalizada.");
}
