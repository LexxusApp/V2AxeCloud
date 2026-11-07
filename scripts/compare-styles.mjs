import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const p5 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await p5.goto('http://localhost:5000', { waitUntil: 'networkidle' });
  const d5 = await p5.evaluate(() => {
    const s = document.querySelector('.app-sidebar');
    const m = document.querySelector('.app-main');
    const h = document.querySelector('h1');
    const c = document.querySelector('.metric-card');
    const l = document.querySelector('.nav-item');
    const topbar = document.querySelector('.app-topbar');
    const grid = document.querySelector('.dashboard-grid');
    return {
      topbar: topbar ? { height: getComputedStyle(topbar).height, pad: getComputedStyle(topbar).padding } : null,
      sidebar: s ? { width: getComputedStyle(s).width, pad: getComputedStyle(s).padding, font: getComputedStyle(s).fontFamily } : null,
      main: m ? { width: getComputedStyle(m).width, maxW: getComputedStyle(m).maxWidth, pad: getComputedStyle(m).padding, margin: getComputedStyle(m).margin } : null,
      grid: grid ? { width: getComputedStyle(grid).width, gap: getComputedStyle(grid).gap, maxW: getComputedStyle(grid).maxWidth } : null,
      h1: h ? { font: getComputedStyle(h).fontFamily, size: getComputedStyle(h).fontSize, weight: getComputedStyle(h).fontWeight } : null,
      card: c ? { width: getComputedStyle(c).width, pad: getComputedStyle(c).padding, r: getComputedStyle(c).borderRadius } : null,
      link: l ? { font: getComputedStyle(l).fontFamily, size: getComputedStyle(l).fontSize, pad: getComputedStyle(l).padding, margin: getComputedStyle(l).margin } : null
    };
  });

  const p4 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await p4.goto('http://localhost:4173/dashboard', { waitUntil: 'networkidle' });
  const d4 = await p4.evaluate(() => {
    const s = document.querySelector('.app-sidebar') || document.querySelector('.berry-sidebar');
    const m = document.querySelector('.app-main') || document.querySelector('.berry-main');
    const h = document.querySelector('h1');
    const c = document.querySelector('.metric-card');
    const l = document.querySelector('.nav-item') || document.querySelector('.nav-item-link');
    const topbar = document.querySelector('.app-topbar') || document.querySelector('.berry-topbar');
    const grid = document.querySelector('.dashboard-grid') || document.querySelector('.berry-dashboard-grid');
    return {
      topbar: topbar ? { height: getComputedStyle(topbar).height, pad: getComputedStyle(topbar).padding } : null,
      sidebar: s ? { width: getComputedStyle(s).width, pad: getComputedStyle(s).padding, font: getComputedStyle(s).fontFamily } : null,
      main: m ? { width: getComputedStyle(m).width, maxW: getComputedStyle(m).maxWidth, pad: getComputedStyle(m).padding, margin: getComputedStyle(m).margin } : null,
      grid: grid ? { width: getComputedStyle(grid).width, gap: getComputedStyle(grid).gap, maxW: getComputedStyle(grid).maxWidth } : null,
      h1: h ? { font: getComputedStyle(h).fontFamily, size: getComputedStyle(h).fontSize, weight: getComputedStyle(h).fontWeight } : null,
      card: c ? { width: getComputedStyle(c).width, pad: getComputedStyle(c).padding, r: getComputedStyle(c).borderRadius } : null,
      link: l ? { font: getComputedStyle(l).fontFamily, size: getComputedStyle(l).fontSize, pad: getComputedStyle(l).padding, margin: getComputedStyle(l).margin } : null
    };
  });

  console.log('5000:', JSON.stringify(d5, null, 2));
  console.log('4173:', JSON.stringify(d4, null, 2));
  await browser.close();
})();
