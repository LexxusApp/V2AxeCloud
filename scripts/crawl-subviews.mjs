import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/live-system-inspection/pages";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator(".axe-login-path-dark").click();
  await page.getByPlaceholder("Digite seu e-mail").fill(email);
  const pw = page.getByPlaceholder("Digite sua senha");
  await pw.fill(password);
  await pw.press("Enter");
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForTimeout(3000);

  // Expand sidebar first
  const expandBtn = page.locator("button:has-text('Kwe Nago')").first();
  const toggleBtn = page.locator("aside button").first();
  await toggleBtn.click();
  await page.waitForTimeout(500);

  // Click on Casa to see submenus or view
  const casaBtn = page.locator("button:has-text('Casa')").first();
  if (await casaBtn.count()) {
    console.log("Clicando em Casa...");
    await casaBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/12-casa-opened.png` });
  }

  // Click on Financeiro to see submenus or view
  const finBtn = page.locator("button:has-text('Financeiro')").first();
  if (await finBtn.count()) {
    console.log("Clicando em Financeiro...");
    await finBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/13-financeiro-opened.png` });
  }

  // Click on Galeria
  const galBtn = page.locator("button:has-text('Galeria')").first();
  if (await galBtn.count()) {
    console.log("Clicando em Galeria...");
    await galBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outputDir}/14-galeria-view.png` });
  }

  // Click on Configuracoes
  const cfgBtn = page.locator("button:has-text('Configurações')").first();
  if (await cfgBtn.count()) {
    console.log("Clicando em Configurações...");
    await cfgBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outputDir}/15-configuracoes-view.png` });
  }

  console.log("Capturas de subpáginas concluídas com sucesso!");
} catch (err) {
  console.error("Erro:", err);
} finally {
  await browser.close();
}
