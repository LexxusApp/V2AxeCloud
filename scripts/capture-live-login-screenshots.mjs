import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

async function capture() {
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop Screenshot (Zelador Tab)
    const pageDesk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await pageDesk.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle' });
    await pageDesk.waitForTimeout(1500);
    const deskPath = path.join(artifactDir, 'novo-login-producao-desktop.png');
    await pageDesk.screenshot({ path: deskPath, fullPage: false });
    console.log('Desktop screenshot salvo em:', deskPath);

    // 2. Desktop Screenshot (Membro Tab com Busca Inteligente ativa)
    const membroBtn = await pageDesk.$('button.role-tab-btn:has-text("Sou Membro(a)")');
    if (membroBtn) {
      await membroBtn.click();
      await pageDesk.waitForTimeout(500);
      const input = await pageDesk.$('input[placeholder*="celular"]');
      if (input) {
        await input.fill('21972878566');
      }
      const pwd = await pageDesk.$('input[placeholder*="123456"]');
      if (pwd) {
        await pwd.fill('003602');
      }
      await pageDesk.waitForTimeout(500);
      const deskMembroPath = path.join(artifactDir, 'novo-login-producao-membro-desktop.png');
      await pageDesk.screenshot({ path: deskMembroPath, fullPage: false });
      console.log('Desktop Membro screenshot salvo em:', deskMembroPath);
    }
    await pageDesk.close();

    // 3. Mobile Screenshot (iPhone 14 Viewport 390x844)
    const pageMob = await browser.newPage({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    });
    await pageMob.goto('https://axecloud.com.br/entrar', { waitUntil: 'networkidle' });
    await pageMob.waitForTimeout(1500);
    const mobPath = path.join(artifactDir, 'novo-login-producao-mobile.png');
    await pageMob.screenshot({ path: mobPath, fullPage: false });
    console.log('Mobile screenshot salvo em:', mobPath);

    // 4. Mobile Membro Tab
    const mobMembroBtn = await pageMob.$('button.role-tab-btn:has-text("Sou Membro(a)")');
    if (mobMembroBtn) {
      await mobMembroBtn.click();
      await pageMob.waitForTimeout(500);
      const input = await pageMob.$('input[placeholder*="celular"]');
      if (input) {
        await input.fill('21972878566');
      }
      const pwd = await pageMob.$('input[placeholder*="123456"]');
      if (pwd) {
        await pwd.fill('003602');
      }
      await pageMob.waitForTimeout(500);
      const mobMembroPath = path.join(artifactDir, 'novo-login-producao-membro-mobile.png');
      await pageMob.screenshot({ path: mobMembroPath, fullPage: false });
      console.log('Mobile Membro screenshot salvo em:', mobMembroPath);
    }
    await pageMob.close();

  } finally {
    await browser.close();
  }
}

capture().catch(console.error);
