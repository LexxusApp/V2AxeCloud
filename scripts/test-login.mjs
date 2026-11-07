import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/live-system-inspection";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Iniciando teste de login em " + baseUrl + "...");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();

page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

try {
  // Navigate directly with ?modo=zelador
  console.log("Acessando com ?modo=zelador...");
  await page.goto(`${baseUrl}/login?modo=zelador`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outputDir}/10-zelador-form.png` });

  const emailInput = page.getByPlaceholder(/digite seu e-mail/i).first();
  const passwordInput = page.getByPlaceholder(/digite sua senha/i).first();

  if (await emailInput.count()) {
    console.log("Preenchendo e-mail e senha de zelador...");
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await page.screenshot({ path: `${outputDir}/11-zelador-filled.png` });

    const submitBtn = page.getByRole("button", { name: /entrar/i }).first();
    console.log("Submetendo formulário...");
    if (await submitBtn.count()) {
      await submitBtn.click();
    } else {
      await passwordInput.press("Enter");
    }

    console.log("Aguardando resposta do login...");
    await page.waitForTimeout(8000);
    console.log("URL após submissão:", page.url());
    await page.screenshot({ path: `${outputDir}/12-zelador-result.png` });

    // Check if error message appeared
    const errorEl = page.locator(".text-red-500, .text-rose-500, [role='alert']").first();
    if (await errorEl.count()) {
      console.log("Mensagem de erro encontrada:", await errorEl.innerText());
    }
  } else {
    console.log("Input de e-mail não encontrado na página de zelador.");
  }

  // Also check if we are on dashboard or if redirect occurred
  if (page.url().includes("/dashboard") || page.url().includes("/app")) {
    console.log("Login realizado com sucesso! Capturando sistema autenticado...");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outputDir}/13-authenticated-dashboard.png` });

    // Capture other pages
    const routes = [
      { name: "14-children", path: "/children" },
      { name: "15-financial", path: "/financial" },
      { name: "16-calendar", path: "/calendar" },
      { name: "17-settings", path: "/settings" },
    ];
    for (const r of routes) {
      console.log(`Navegando para ${r.path}...`);
      await page.goto(`${baseUrl}${r.path}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${outputDir}/${r.name}.png` });
    }
  } else {
    console.log("Não redirecionou para dashboard. Verificando estado atual...");
  }
} catch (err) {
  console.error("Erro no teste:", err);
  await page.screenshot({ path: `${outputDir}/error.png` });
} finally {
  await browser.close();
  console.log("Finalizado.");
}
