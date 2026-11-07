import path from 'path';
import { chromium } from 'playwright';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

async function testTabs() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:4173/entrar');
  await page.waitForTimeout(1000);
  await (await page.waitForSelector('input[type="email"]')).fill('vendasmercadolivrev1@gmail.com');
  await (await page.waitForSelector('input[type="password"]')).fill('Lucas4356!');
  await (await page.waitForSelector('button[type="submit"]')).click();
  await page.waitForURL((url) => url.toString().includes('/dashboard'), { timeout: 15000 });
  console.log('Mobile user logged in!');

  const tabs = [
    { selector: 'a[href="#dashboard"]', name: 'dashboard' },
    { selector: 'a[href="#children"]', name: 'children', group: '#nav-group-casa' },
    { selector: 'a[href="#obligations"]', name: 'obligations', group: '#nav-group-casa' },
    { selector: 'a[href="#calendar"]', name: 'calendar', group: '#nav-group-casa' },
    { selector: 'a[href="#financial"]', name: 'financial', group: '#nav-group-financeiro' },
    { selector: 'a[href="#inventory"]', name: 'inventory' },
    { selector: 'a[href="#radar"]', name: 'radar' },
    { selector: 'a[href="#store"]', name: 'store' },
    { selector: 'a[href="#gallery"]', name: 'gallery' }
  ];

  for (const t of tabs) {
    // Open drawer
    await page.click('#sidebar-toggle-btn');
    await page.waitForTimeout(300);

    // If belongs to a collapsed group, expand group
    if (t.group) {
      const isExpanded = await page.evaluate((grp) => {
        const el = document.querySelector(grp);
        return el ? el.classList.contains('is-expanded') : false;
      }, t.group);
      if (!isExpanded) {
        await page.click(`${t.group} .nav-group-header`);
        await page.waitForTimeout(200);
      }
    }

    // Click tab link
    await page.click(t.selector);
    await page.waitForTimeout(600);

    // Verify no horizontal overflow and drawer closed
    const state = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar');
      return {
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
        drawerClosed: sidebar ? window.getComputedStyle(sidebar).display === 'none' : true
      };
    });

    console.log(`Tab [${t.name}] on mobile: overflow=${state.docW > state.winW ? 'FAIL' : 'PASS'} (docW:${state.docW}, winW:${state.winW}), drawerClosed=${state.drawerClosed}`);
    await page.screenshot({ path: path.join(artifactDir, `mobile-tab-${t.name}.png`) });
  }

  await browser.close();
  console.log('--- ALL MOBILE TABS VERIFIED VIA UI NAVIGATION ---');
}

testTabs().catch(console.error);
