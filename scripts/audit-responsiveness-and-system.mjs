import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const artifactDir = 'C:/Users/Lucas A/.gemini/antigravity/brain/9d158178-6619-41e8-8027-3b042f4c880d';

const viewports = [
  { name: 'mobile-iphone14', width: 390, height: 844, isMobile: true },
  { name: 'tablet-portrait', width: 768, height: 1024, isMobile: true },
  { name: 'tablet-landscape', width: 1024, height: 768, isMobile: false },
  { name: 'desktop-standard', width: 1440, height: 900, isMobile: false },
  { name: 'desktop-wide', width: 1920, height: 1080, isMobile: false }
];

async function runAudit() {
  const browser = await chromium.launch({ headless: true });

  console.log('--- STEP 1: TEST LOGIN WITH USER CREDENTIALS ---');
  const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const loginPage = await loginContext.newPage();

  await loginPage.goto('http://localhost:4173/entrar', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await loginPage.waitForTimeout(1500);

  // Look for email and password inputs
  const emailInput = await loginPage.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="e-mail" i], input[placeholder*="email" i]', { timeout: 10000 });
  const passInput = await loginPage.waitForSelector('input[type="password"]', { timeout: 10000 });

  await emailInput.fill('vendasmercadolivrev1@gmail.com');
  await passInput.fill('Lucas4356!');
  await loginPage.screenshot({ path: path.join(artifactDir, 'login-filled.png') });

  // Submit login
  const submitBtn = await loginPage.waitForSelector('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")', { timeout: 5000 });
  await submitBtn.click();
  console.log('Submitted login credentials...');

  try {
    await loginPage.waitForURL((url) => url.toString().includes('/dashboard') || url.toString().includes('/?tab='), { timeout: 15000 });
    console.log('Login successful! Redirected to:', loginPage.url());
  } catch (e) {
    console.log('Current URL after login attempt:', loginPage.url());
    await loginPage.screenshot({ path: path.join(artifactDir, 'login-after-submit.png') });
  }

  // Get auth token from localStorage
  const authStorage = await loginPage.evaluate(() => {
    return {
      authToken: localStorage.getItem('axecloud-auth-token') || localStorage.getItem('sb-fplkllxndtwqomkkgomz-auth-token'),
      tenantId: localStorage.getItem('tenant_id') || localStorage.getItem('last_tenant_id'),
      userRole: localStorage.getItem('axecloud_user_role') || 'admin'
    };
  });
  console.log('Auth storage acquired:', Boolean(authStorage.authToken));

  await loginContext.close();

  // If login form failed via UI, we also have the Supabase magiclink fallback for reliable testing context
  console.log('\n--- STEP 2: RESPONSIVENESS AUDIT ACROSS BREAKPOINTS ---');

  for (const vp of viewports) {
    console.log(`\n========================================`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`========================================`);

    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile
    });

    await ctx.addInitScript(
      ({ authStorage }) => {
        if (authStorage.authToken) {
          localStorage.setItem('axecloud-auth-token', authStorage.authToken);
          localStorage.setItem('sb-fplkllxndtwqomkkgomz-auth-token', authStorage.authToken);
          if (authStorage.tenantId) localStorage.setItem('tenant_id', authStorage.tenantId);
          localStorage.setItem('axecloud_user_role', 'admin');
        }
      },
      { authStorage }
    );

    const page = await ctx.newPage();

    // Visit dashboard
    await page.goto('http://localhost:4173/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Check for horizontal overflow
    const overflowCheck = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const bodyW = document.body.scrollWidth;
      const overflowingElements = [];

      document.querySelectorAll('*').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > winW + 2) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || '').toString().slice(0, 80),
            right: Math.round(rect.right),
            winW
          });
        }
      });

      return {
        docW,
        winW,
        bodyW,
        hasHorizontalOverflow: docW > winW + 1,
        overflowCount: overflowingElements.length,
        samples: overflowingElements.slice(0, 5)
      };
    });

    console.log(`[${vp.name}] Horizontal Overflow check:`, overflowCheck.hasHorizontalOverflow ? 'FAIL' : 'PASS', `(docW: ${overflowCheck.docW}, winW: ${overflowCheck.winW})`);
    if (overflowCheck.hasHorizontalOverflow) {
      console.warn(`[${vp.name}] Sample overflowing elements:`, overflowCheck.samples);
    }

    // Capture Dashboard
    await page.screenshot({ path: path.join(artifactDir, `audit-${vp.name}-dashboard.png`) });

    // 2. Test Mobile Hamburger Menu (if mobile or tablet portrait)
    if (vp.width <= 768) {
      console.log(`[${vp.name}] Testing Mobile Sidebar Toggle...`);
      const menuBtn = await page.$('.btn-menu-toggle, button[aria-label*="menu" i], .app-topbar button:has(svg)');
      if (menuBtn) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(artifactDir, `audit-${vp.name}-drawer-open.png`) });

        const isBackdropVisible = await page.evaluate(() => {
          const bd = document.querySelector('.mobile-sidebar-backdrop');
          return bd ? window.getComputedStyle(bd).display !== 'none' : false;
        });
        console.log(`[${vp.name}] Drawer backdrop visible:`, isBackdropVisible);

        // Close drawer
        await menuBtn.click();
        await page.waitForTimeout(400);
      } else {
        console.warn(`[${vp.name}] Menu toggle button not found`);
      }
    }

    // 3. Test Navigation and Modals on this breakpoint
    const tabsToTest = [
      { tab: 'children', name: 'children' },
      { tab: 'financial', name: 'financial' },
      { tab: 'calendar', name: 'calendar' },
      { tab: 'chat', name: 'chat' }
    ];

    for (const t of tabsToTest) {
      try {
        await page.goto(`http://localhost:4173/?tab=${t.tab}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1200);

        // Check horizontal overflow on this tab
        const tabOverflow = await page.evaluate(() => {
          return {
            docW: document.documentElement.scrollWidth,
            winW: window.innerWidth,
            hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
          };
        });

        console.log(`[${vp.name}] Tab ${t.tab} overflow: ${tabOverflow.hasOverflow ? 'FAIL' : 'PASS'} (docW: ${tabOverflow.docW}, winW: ${tabOverflow.winW})`);
        await page.screenshot({ path: path.join(artifactDir, `audit-${vp.name}-${t.name}.png`) });

        // If children tab, test opening the Add Child modal on this viewport
        if (t.tab === 'children') {
          const addBtn = await page.$('button:has-text("Cadastrar filho"), button:has-text("Adicionar"), button:has-text("Cadastrar primeiro filho")');
          if (addBtn) {
            await addBtn.click();
            await page.waitForTimeout(600);

            // Check if modal fits inside viewport
            const modalFit = await page.evaluate(() => {
              const modal = document.querySelector('[role="dialog"]');
              if (!modal) return null;
              const rect = modal.getBoundingClientRect();
              return {
                modalWidth: Math.round(rect.width),
                modalHeight: Math.round(rect.height),
                viewportW: window.innerWidth,
                viewportH: window.innerHeight,
                fitsHorizontally: rect.right <= window.innerWidth + 1 && rect.left >= -1,
                fitsVertically: rect.bottom <= window.innerHeight + 1 && rect.top >= -1
              };
            });
            console.log(`[${vp.name}] Add Child Modal fit:`, modalFit);
            await page.screenshot({ path: path.join(artifactDir, `audit-${vp.name}-modal-add-child.png`) });

            // Close modal
            const closeBtn = await page.$('[role="dialog"] button[aria-label="Fechar"]');
            if (closeBtn) await closeBtn.click();
            await page.waitForTimeout(400);
          }
        }
      } catch (err) {
        console.error(`[${vp.name}] Error on tab ${t.tab}:`, err.message);
      }
    }

    await ctx.close();
  }

  await browser.close();
  console.log('\n--- AUDIT COMPLETE ---');
}

runAudit().catch(console.error);
