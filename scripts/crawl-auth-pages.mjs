import { chromium } from "playwright";
import fs from "fs";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";

const outputDir = "artifacts/live-system-inspection/pages";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("Iniciando varredura das páginas autenticadas...");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
});
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // Enter as Zelador
  await page.locator(".axe-login-path-dark").click();
  await page.waitForTimeout(1000);

  await page.getByPlaceholder("Digite seu e-mail").fill(email);
  const passwordInput = page.getByPlaceholder("Digite sua senha");
  await passwordInput.fill(password);
  await passwordInput.press("Enter");

  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForTimeout(4000);

  console.log("Autenticado com sucesso na dashboard!");
  await page.screenshot({ path: `${outputDir}/01-dashboard.png` });

  // Let's inspect all links/buttons in the sidebar
  const sidebarLinks = await page.locator("aside a, aside button, nav a, nav button").evaluateAll(els => 
    els.map((el, i) => ({
      index: i,
      tag: el.tagName,
      href: el.getAttribute("href"),
      title: el.getAttribute("title") || el.getAttribute("aria-label") || el.innerText,
      class: el.className
    }))
  );
  console.log("Elementos do menu lateral encontrados:", JSON.stringify(sidebarLinks, null, 2));

  // Navigate through the actual routes using client-side navigation
  const routes = [
    { name: "02-corrente-membros", selector: "a[href*='children'], a[href*='filhos'], a[title*='Membro'], button[title*='Membro']" },
    { name: "03-financeiro", selector: "a[href*='financial'], a[href*='financeiro'], a[title*='Financeiro']" },
    { name: "04-calendario", selector: "a[href*='calendar'], a[href*='calendario'], a[title*='Calendário'], a[title*='Gira']" },
    { name: "05-comunicados", selector: "a[href*='notices'], a[href*='comunicados'], a[title*='Comunicado']" },
    { name: "06-preceito", selector: "a[href*='preceito'], a[title*='Preceito']" },
    { name: "07-atendimentos", selector: "a[href*='consultations'], a[href*='atendimentos']" },
    { name: "08-galeria", selector: "a[href*='gallery'], a[href*='galeria']" },
    { name: "09-almoxarifado", selector: "a[href*='inventory'], a[href*='almoxarifado']" },
    { name: "10-configuracoes", selector: "a[href*='settings'], a[href*='configuracoes']" },
  ];

  for (const r of routes) {
    try {
      console.log(`Buscando link para ${r.name}...`);
      const link = page.locator(r.selector).first();
      if (await link.count()) {
        await link.click();
        await page.waitForTimeout(3000);
        console.log(`Capturando ${r.name} na URL: ${page.url()}`);
        await page.screenshot({ path: `${outputDir}/${r.name}.png` });
      } else {
        // Try direct pushState / router navigation
        const pathPart = r.selector.match(/href\*='([^']+)'/)?.[1];
        if (pathPart) {
          console.log(`Tentando navegação interna para /${pathPart}...`);
          await page.evaluate((p) => window.history.pushState({}, '', `/${p}`), pathPart);
          window.dispatchEvent?.(new PopStateEvent('popstate'));
          await page.waitForTimeout(3000);
          await page.screenshot({ path: `${outputDir}/${r.name}.png` });
        }
      }
    } catch (e) {
      console.log(`Erro ao navegar para ${r.name}:`, e.message);
    }
  }

  // Also expand the sidebar if there's a toggle button!
  const expandBtn = page.locator("button[title*='expand'], button[aria-label*='expand'], aside button").first();
  if (await expandBtn.count()) {
    console.log("Clicando para expandir sidebar...");
    await expandBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outputDir}/11-sidebar-expanded.png` });
  }

  console.log("Varredura completa!");
} catch (err) {
  console.error("Erro na varredura:", err);
} finally {
  await browser.close();
}
