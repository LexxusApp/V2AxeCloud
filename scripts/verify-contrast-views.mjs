import { chromium } from "playwright";
import path from "path";

const email = "miriambarbosa222@yahoo.com.br";
const password = "43562600";
const baseUrl = "https://axecloud.com.br";
const artifactDir = "C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d";

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    console.log("Navigating to login...");
    await page.goto(`${baseUrl}/entrar`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const emailInput = await page.$('input[type="email"], input[placeholder*="e-mail" i], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.fill(email);
    }
    const pwdInput = await page.$('input[type="password"]');
    if (pwdInput) {
      await pwdInput.fill(password);
      await pwdInput.press("Enter");
    }

    console.log("Waiting for dashboard...");
    await page.waitForSelector('button:has-text("Ver corrente")', { timeout: 20000 });
    await page.waitForTimeout(2000);

    console.log("Clicking 'Ver corrente'...");
    await page.click('button:has-text("Ver corrente")');
    await page.waitForSelector('.current-person__main', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Click the first person to open the drawer
    console.log("Clicking first child .current-person__main...");
    await page.locator('.current-person__main').first().click();
    await page.waitForSelector('.current-person-dossier', { timeout: 10000 });
    await page.waitForTimeout(1500);

    const drawerShot = path.join(artifactDir, "contraste-gaveta-producao.png");
    await page.screenshot({ path: drawerShot });
    console.log("Drawer screenshot saved successfully:", drawerShot);

    // Click "Ver perfil completo" inside the drawer
    console.log("Clicking 'Ver perfil completo'...");
    const verPerfilBtn = page.locator('button:has-text("Ver perfil completo")').first();
    await verPerfilBtn.click();
    await page.waitForSelector('section[aria-label="Resumo do perfil"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const profileShot = path.join(artifactDir, "contraste-perfil-producao.png");
    await page.screenshot({ path: profileShot });
    console.log("Profile screenshot saved successfully:", profileShot);

  } catch (err) {
    console.error("Verification error:", err);
    await page.screenshot({ path: path.join(artifactDir, "contraste-debug.png") });
  } finally {
    await browser.close();
  }
}

verify();
