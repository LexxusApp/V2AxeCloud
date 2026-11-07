import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/live-system-inspection";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Iniciando login no sistema...");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();

page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // Click Sou zelador
  console.log("Clicando em 'Sou zelador(a)'...");
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(1000);

  console.log("Preenchendo credenciais...");
  const emailInput = page.getByPlaceholder("Digite seu e-mail");
  const passwordInput = page.getByPlaceholder("Digite sua senha");
  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.screenshot({ path: `${outputDir}/20-form-filled.png` });

  console.log("Clicando no botão de entrar...");
  const submitBtn = page.getByRole("button", { name: /entrar na gestão/i }).first();
  if (await submitBtn.count()) {
    await submitBtn.click();
  } else {
    await passwordInput.press("Enter");
  }

  // Wait for response / redirect
  console.log("Aguardando autenticação (10s)...");
  await page.waitForTimeout(10000);

  console.log("URL após login:", page.url());
  await page.screenshot({ path: `${outputDir}/21-after-login.png` });

  // If error message is present, log it
  const alertEl = page.locator("[role='alert'], .text-red-500, .text-rose-500, .bg-red-500\\/10");
  if (await alertEl.count()) {
    console.log("ALERTA NA TELA:", await alertEl.first().innerText());
  }

  // Let's see if we are authenticated or redirected
  if (page.url().includes("/dashboard") || page.url().includes("/app")) {
    console.log("LOGIN BEM SUCEDIDO! Capturando telas do sistema...");

    // 1. Dashboard Desktop
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outputDir}/22-live-dashboard-desktop.png`, fullPage: false });

    // 2. Dashboard Mobile
    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outputDir}/23-live-dashboard-mobile.png`, fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);

    // 3. Other pages in the navigation
    const pagesToCapture = [
      { name: "24-membros", path: "/children" },
      { name: "25-giras-calendario", path: "/calendar" },
      { name: "26-financeiro", path: "/financial" },
      { name: "27-comunicados", path: "/notices" },
      { name: "28-configuracoes", path: "/settings" },
      { name: "29-almoxarifado", path: "/inventory" },
      { name: "30-atendimentos", path: "/consultations" },
    ];

    for (const p of pagesToCapture) {
      try {
        console.log(`Navegando para ${p.path}...`);
        await page.goto(`${baseUrl}${p.path}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${outputDir}/${p.name}.png` });
      } catch (err) {
        console.log(`Erro ao capturar ${p.path}:`, err.message);
      }
    }
  } else {
    // What if this user is a 'membro'? Let's check!
    console.log("Tentativa como zelador não entrou imediatamente. Verificando se é membro...");
  }
} catch (err) {
  console.error("Erro durante o processo:", err);
} finally {
  await browser.close();
  console.log("Processo concluído.");
}
