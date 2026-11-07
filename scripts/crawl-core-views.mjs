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

  // Expand sidebar
  await page.locator("aside button").first().click();
  await page.waitForTimeout(500);

  // Click Casa accordion
  await page.locator("button:has-text('Casa')").first().click();
  await page.waitForTimeout(500);

  // Click Filhos de Santo
  const filhosBtn = page.locator("button:has-text('Filhos de Santo')").first();
  if (await filhosBtn.count()) {
    console.log("Clicando em Filhos de Santo...");
    await filhosBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outputDir}/16-filhos-de-santo.png` });
  }

  // Click Giras
  const girasBtn = page.locator("button:has-text('Giras')").first();
  if (await girasBtn.count()) {
    console.log("Clicando em Giras...");
    await girasBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outputDir}/17-giras.png` });
  }

  // Click Financeiro -> Visão geral
  await page.locator("button:has-text('Financeiro')").first().click();
  await page.waitForTimeout(500);
  const finGeralBtn = page.locator("button:has-text('Visão geral')").first();
  if (await finGeralBtn.count()) {
    console.log("Clicando em Visão Geral Financeiro...");
    await finGeralBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outputDir}/18-financeiro-visao-geral.png` });
  }

  console.log("Capturas de Filhos e Giras finalizadas!");
} catch (e) {
  console.error("Erro:", e);
} finally {
  await browser.close();
}
