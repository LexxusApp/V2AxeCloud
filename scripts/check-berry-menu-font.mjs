import { chromium } from 'playwright';

async function checkBerryFont() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    console.log('Navegando para Berry Dashboard...');
    await page.goto('https://berrydashboard.com/free/dashboard/default', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const fontLinks = Array.from(document.querySelectorAll('link[href*="font"], link[rel="stylesheet"]')).map(
        (l) => l.href,
      );

      // Check all nav elements
      const nav = document.querySelector('nav') || document.querySelector('aside');
      const allNavTexts = nav ? Array.from(nav.querySelectorAll('*')) : [];
      const sampleStyles = [];

      for (const el of allNavTexts) {
        if (el.children.length === 0 && el.innerText && el.innerText.trim().length > 0) {
          const cs = window.getComputedStyle(el);
          sampleStyles.push({
            text: el.innerText.trim(),
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
            color: cs.color,
          });
          if (sampleStyles.length >= 8) break;
        }
      }

      return {
        fontLinks,
        sampleStyles,
      };
    });

    console.log('RESULTADO DETALHADO BERRY:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await browser.close();
  }
}

checkBerryFont().catch(console.error);
