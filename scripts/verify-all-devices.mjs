import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

async function runVerification() {
  console.log('--- STEP 1: AUTHENTICATION WITH TEST ACCOUNT ---');
  const browser = await chromium.launch({ headless: true });
  const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const loginPage = await loginContext.newPage();

  await loginPage.goto('http://localhost:4173/entrar', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await loginPage.waitForTimeout(1000);

  const emailInput = await loginPage.waitForSelector('input[type="email"], input[placeholder*="email" i]');
  const passInput = await loginPage.waitForSelector('input[type="password"]');
  await emailInput.fill('vendasmercadolivrev1@gmail.com');
  await passInput.fill('Lucas4356!');
  const submitBtn = await loginPage.waitForSelector('button[type="submit"], button:has-text("Entrar")');
  await submitBtn.click();

  await loginPage.waitForURL((url) => url.toString().includes('/dashboard') || url.toString().includes('/?tab='), { timeout: 15000 });
  console.log('Login verified! Landed on:', loginPage.url());

  const authStorage = await loginPage.evaluate(() => {
    return {
      authToken: localStorage.getItem('axecloud-auth-token') || localStorage.getItem('sb-fplkllxndtwqomkkgomz-auth-token'),
      tenantId: localStorage.getItem('tenant_id') || localStorage.getItem('last_tenant_id'),
      userRole: localStorage.getItem('axecloud_user_role') || 'admin'
    };
  });
  await loginContext.close();

  const breakpoints = [
    { name: 'mobile-iphone14', width: 390, height: 844, isMobile: true },
    { name: 'tablet-portrait', width: 768, height: 1024, isMobile: true },
    { name: 'tablet-landscape', width: 1024, height: 768, isMobile: false },
    { name: 'desktop-standard', width: 1440, height: 900, isMobile: false },
    { name: 'desktop-ultrawide', width: 1920, height: 1080, isMobile: false }
  ];

  const results = [];

  for (const bp of breakpoints) {
    console.log(`\n========================================`);
    console.log(`TESTING: ${bp.name} (${bp.width}x${bp.height})`);
    console.log(`========================================`);

    const ctx = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: 1,
      isMobile: bp.isMobile,
      hasTouch: bp.isMobile
    });

    await ctx.addInitScript(({ authStorage }) => {
      if (authStorage.authToken) {
        localStorage.setItem('axecloud-auth-token', authStorage.authToken);
        localStorage.setItem('sb-fplkllxndtwqomkkgomz-auth-token', authStorage.authToken);
        if (authStorage.tenantId) localStorage.setItem('tenant_id', authStorage.tenantId);
        localStorage.setItem('axecloud_user_role', 'admin');
      }
    }, { authStorage });

    const page = await ctx.newPage();
    await page.goto('http://localhost:4173/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // 1. Check Horizontal Overflow on Dashboard
    const overflowCheck = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const chip = document.querySelector('.profile-chip-container');
      const chipRect = chip ? chip.getBoundingClientRect() : null;
      const topbar = document.querySelector('.app-topbar');
      const topbarRect = topbar ? topbar.getBoundingClientRect() : null;
      const sidebar = document.querySelector('.app-sidebar');
      const sidebarVisible = sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false;
      const sidebarW = sidebar ? sidebar.getBoundingClientRect().width : 0;

      return {
        docW,
        winW,
        hasHorizontalOverflow: docW > winW + 1,
        chipRect,
        chipVisible: chipRect ? chipRect.right <= winW + 1 && chipRect.left >= 0 : false,
        topbarRect,
        sidebarVisible,
        sidebarW
      };
    });

    console.log(`[${bp.name}] Dashboard Horizontal Overflow:`, overflowCheck.hasHorizontalOverflow ? 'FAIL' : 'PASS', `(docW: ${overflowCheck.docW}, winW: ${overflowCheck.winW})`);
    console.log(`[${bp.name}] Profile Chip visible inside screen:`, overflowCheck.chipVisible, overflowCheck.chipRect);
    console.log(`[${bp.name}] Sidebar visible on initial load:`, overflowCheck.sidebarVisible, `(width: ${overflowCheck.sidebarW}px)`);

    await page.screenshot({ path: path.join(artifactDir, `verified-${bp.name}-dashboard.png`) });

    // 2. Test Mobile / Tablet Drawer toggle
    if (bp.width <= 1024) {
      console.log(`[${bp.name}] Testing Menu Toggle & Drawer...`);
      const menuBtn = await page.$('#sidebar-toggle-btn');
      if (menuBtn) {
        await menuBtn.click();
        await page.waitForTimeout(400);

        const drawerOpenCheck = await page.evaluate(() => {
          const sidebar = document.querySelector('.app-sidebar');
          const bd = document.querySelector('.mobile-sidebar-backdrop');
          return {
            sidebarDisplay: sidebar ? window.getComputedStyle(sidebar).display : 'none',
            sidebarRect: sidebar ? sidebar.getBoundingClientRect() : null,
            backdropVisible: bd ? window.getComputedStyle(bd).display !== 'none' : false
          };
        });
        console.log(`[${bp.name}] Drawer state after click:`, drawerOpenCheck);
        await page.screenshot({ path: path.join(artifactDir, `verified-${bp.name}-drawer-open.png`) });

        // Close drawer by tapping the backdrop outside the drawer
        await page.mouse.click(bp.width - 20, 200);
        await page.waitForTimeout(400);

        const drawerClosed = await page.evaluate(() => {
          const sidebar = document.querySelector('.app-sidebar');
          return sidebar ? window.getComputedStyle(sidebar).display === 'none' : true;
        });
        console.log(`[${bp.name}] Drawer closed after outside click:`, drawerClosed);
      }
    }

    // 3. Test Profile Popover on this breakpoint
    console.log(`[${bp.name}] Testing Profile Popover click...`);
    const chipBtn = await page.$('#profile-chip-btn');
    if (chipBtn) {
      await chipBtn.click();
      await page.waitForTimeout(500);

      const popoverCheck = await page.evaluate(() => {
        const dd = document.querySelector('#profile-dropdown');
        if (!dd) return { found: false };
        const rect = dd.getBoundingClientRect();
        const planTitle = dd.querySelector('.plan-card-title')?.textContent || '';
        const planDesc = dd.querySelector('.plan-card-desc')?.textContent || '';
        const waToggle = dd.querySelector('input[type="checkbox"]')?.checked;
        return {
          found: true,
          rect,
          planTitle,
          planDesc,
          waToggle,
          fitsHorizontally: rect.right <= window.innerWidth + 2 && rect.left >= -2
        };
      });

      console.log(`[${bp.name}] Popover verification:`, popoverCheck);
      await page.screenshot({ path: path.join(artifactDir, `verified-${bp.name}-profile-popover.png`) });

      // Close popover
      await chipBtn.click();
      await page.waitForTimeout(300);
    }

    // 4. Test Key Views on this breakpoint
    const tabs = ['children', 'financial', 'calendar', 'radar'];
    for (const t of tabs) {
      try {
        await page.goto(`http://localhost:4173/?tab=${t}`, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(1500);

        const viewCheck = await page.evaluate(() => {
          return {
            docW: document.documentElement.scrollWidth,
            winW: window.innerWidth,
            hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
          };
        });

        console.log(`[${bp.name}] Tab ${t} overflow:`, viewCheck.hasOverflow ? 'FAIL' : 'PASS', `(${viewCheck.docW} vs ${viewCheck.winW})`);
        await page.screenshot({ path: path.join(artifactDir, `verified-${bp.name}-${t}.png`) });
      } catch (err) {
        console.log(`[${bp.name}] Tab ${t} error:`, err.message);
      }
    }

    results.push({
      breakpoint: bp.name,
      width: bp.width,
      hasOverflow: overflowCheck.hasHorizontalOverflow,
      chipVisible: overflowCheck.chipVisible
    });

    await ctx.close();
  }

  await browser.close();
  console.log('\n========================================');
  console.log('--- ALL BREAKPOINTS VERIFICATION SUMMARY ---');
  console.log('========================================');
  console.table(results);
}

runVerification().catch(console.error);
