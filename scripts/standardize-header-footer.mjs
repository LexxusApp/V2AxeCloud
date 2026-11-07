import fs from 'fs';
import path from 'path';

// 1. UPDATE cinematic-site/terreiros-v2.css
const terrPath = 'cinematic-site/terreiros-v2.css';
if (fs.existsSync(terrPath)) {
  let terrCss = fs.readFileSync(terrPath, 'utf8').replace(/\r\n/g, '\n');

  // Replace baseline .cx-footer definitions
  const oldFooterRegex = /\.cx-footer\s*\{[\s\S]*?\.cx-footer-top\s*\{\s*justify-self:\s*end;\s*\}/;
  const newFooterBase = `.cx-footer {
  display: grid;
  min-height: 135px;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 20px 30px;
  padding: 36px 5vw;
  border-top: 1px solid rgba(255, 255, 255, .08);
  background: #0b0d0a;
  color: #b9b8af;
}
.cx-footer > .cx-brand {
  grid-column: 1;
  grid-row: 1;
}
.cx-footer > p {
  grid-column: 2;
  grid-row: 1;
  margin: 0;
  color: #a1a39a;
  font-size: 13px;
  line-height: 1.5;
}
.cx-footer-top,
.cx-footer > a:last-child {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  align-self: center;
  color: #8b8d84;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: color 160ms ease;
}
.cx-footer-top:hover,
.cx-footer > a:last-child:hover {
  color: #f4f0e4;
}
.cx-footer > nav {
  grid-column: 1 / -1;
  grid-row: 2;
  position: static;
  z-index: auto;
  display: flex;
  justify-content: center;
  gap: 28px;
  margin: 0;
  padding: 18px 0 0;
  flex-wrap: wrap;
  border-top: 1px solid rgba(255, 255, 255, .06);
}
.cx-footer > nav a {
  color: #8b8d84;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  transition: color 160ms ease;
}
.cx-footer > nav a:hover {
  color: #f4f0e4;
}`;

  if (oldFooterRegex.test(terrCss)) {
    terrCss = terrCss.replace(oldFooterRegex, newFooterBase);
  } else {
    console.warn('[terreiros-v2.css] oldFooterRegex did not match directly, appending footer base');
    terrCss += '\n' + newFooterBase;
  }

  // Update mobile footer in media query
  const oldMobileFooter = /\.cx-footer\s*\{\s*grid-template-columns:\s*1fr\s*auto;\s*padding:\s*28px\s*18px;\s*\}\s*\.cx-footer\s*p\s*\{\s*display:\s*none;\s*\}\s*\.cx-footer\s*nav\s*\{\s*grid-column:\s*1\s*\/\s*-1;\s*justify-content:\s*flex-start;\s*gap:\s*16px;\s*\}/;
  const newMobileFooter = `.cx-footer {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 32px 20px;
    text-align: left;
  }
  .cx-footer > .cx-brand {
    grid-column: 1;
    grid-row: 1;
  }
  .cx-footer > p {
    grid-column: 1;
    grid-row: 2;
    display: block;
    font-size: 13px;
  }
  .cx-footer > nav {
    grid-column: 1;
    grid-row: 3;
    justify-content: flex-start;
    gap: 14px 20px;
    padding-top: 14px;
  }
  .cx-footer-top,
  .cx-footer > a:last-child {
    grid-column: 1;
    grid-row: 4;
    justify-self: flex-start;
    padding-top: 6px;
    font-size: 13px;
  }`;

  if (oldMobileFooter.test(terrCss)) {
    terrCss = terrCss.replace(oldMobileFooter, newMobileFooter);
  }

  // Add the fluid responsive desktop scaling matching Home page
  const fluidDesktopScale = `
/* ==========================================================================
   ESCALA FLUIDA PADRONIZADA COM A PAGINA INICIAL (1025px+)
   ========================================================================== */
@media (min-width: 1025px) {
  .cx-header {
    width: min(1480px, calc(100% - clamp(32px, 3.5vw, 64px))) !important;
    height: clamp(66px, 4.2vw, 78px) !important;
    padding: 0 clamp(16px, 1.6vw, 28px) !important;
    gap: clamp(20px, 2vw, 36px) !important;
    border-radius: clamp(10px, 0.8vw, 14px) !important;
  }
  .cx-brand {
    gap: clamp(8px, 0.8vw, 12px) !important;
  }
  .cx-brand-trident {
    width: clamp(38px, 2.5vw, 46px) !important;
    height: clamp(48px, 3.2vw, 58px) !important;
  }
  .cx-brand strong {
    font-size: clamp(15px, 1.05vw, 18px) !important;
  }
  .cx-header > nav {
    gap: clamp(22px, 2vw, 36px) !important;
  }
  .cx-header > nav a {
    font-size: clamp(13px, 0.9vw, 15px) !important;
    font-weight: 700 !important;
  }
  .cx-header-contact {
    height: clamp(40px, 2.7vw, 46px) !important;
    padding: 0 clamp(14px, 1.1vw, 20px) !important;
    font-size: clamp(12px, 0.82vw, 14px) !important;
    border-radius: 8px !important;
  }
  .cx-header-login {
    font-size: clamp(13px, 0.88vw, 15px) !important;
    padding: 10px 8px !important;
  }
  .cx-header-cta {
    height: clamp(44px, 3vw, 50px) !important;
    padding: 0 clamp(18px, 1.4vw, 26px) !important;
    font-size: clamp(13px, 0.9vw, 15px) !important;
    border-radius: 8px !important;
    gap: clamp(8px, 0.7vw, 12px) !important;
  }
  .cx-header-cta svg {
    width: clamp(14px, 1vw, 17px) !important;
  }

  .cx-footer {
    min-height: clamp(140px, 10vh, 165px) !important;
    padding: clamp(36px, 3.5vw, 56px) clamp(32px, 4vw, 64px) !important;
    max-width: min(1480px, calc(100% - clamp(32px, 3.5vw, 64px))) !important;
    margin: 0 auto !important;
    border-radius: clamp(12px, 1vw, 16px) clamp(12px, 1vw, 16px) 0 0 !important;
    gap: clamp(24px, 2.5vw, 40px) !important;
  }
  .cx-footer .cx-brand {
    gap: clamp(8px, 0.8vw, 12px) !important;
  }
  .cx-footer .cx-brand-trident {
    width: clamp(38px, 2.5vw, 46px) !important;
    height: clamp(48px, 3.2vw, 58px) !important;
  }
  .cx-footer .cx-brand strong {
    font-size: clamp(15px, 1.05vw, 18px) !important;
  }
  .cx-footer > p {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
  .cx-footer > nav {
    gap: clamp(22px, 2vw, 36px) !important;
    padding-top: clamp(18px, 1.8vw, 26px) !important;
  }
  .cx-footer > nav a {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
  .cx-footer-top,
  .cx-footer > a:last-child {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
}
`;

  if (!terrCss.includes('ESCALA FLUIDA PADRONIZADA COM A PAGINA INICIAL')) {
    terrCss += '\n' + fluidDesktopScale;
  }

  fs.writeFileSync(terrPath, terrCss, 'utf8');
  console.log('✅ Updated cinematic-site/terreiros-v2.css');
}

// 2. UPDATE site-next/app/cinematic.css (Home Page)
const homeCssPath = 'site-next/app/cinematic.css';
if (fs.existsSync(homeCssPath)) {
  let homeCss = fs.readFileSync(homeCssPath, 'utf8').replace(/\r\n/g, '\n');

  const homeFooterScale = `
  .cx-footer {
    min-height: clamp(140px, 10vh, 165px) !important;
    padding: clamp(36px, 3.5vw, 56px) clamp(32px, 4vw, 64px) !important;
    max-width: min(1480px, calc(100% - clamp(32px, 3.5vw, 64px))) !important;
    margin: 0 auto !important;
    border-radius: clamp(12px, 1vw, 16px) clamp(12px, 1vw, 16px) 0 0 !important;
    gap: clamp(24px, 2.5vw, 40px) !important;
  }
  .cx-footer .cx-brand {
    gap: clamp(8px, 0.8vw, 12px) !important;
  }
  .cx-footer .cx-brand-trident {
    width: clamp(38px, 2.5vw, 46px) !important;
    height: clamp(48px, 3.2vw, 58px) !important;
  }
  .cx-footer .cx-brand strong {
    font-size: clamp(15px, 1.05vw, 18px) !important;
  }
  .cx-footer > p {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
  .cx-footer > nav {
    gap: clamp(22px, 2vw, 36px) !important;
    padding-top: clamp(18px, 1.8vw, 26px) !important;
  }
  .cx-footer > nav a {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
  .cx-footer-top,
  .cx-footer > a:last-child {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }`;

  // Insert inside @media (min-width: 1025px) before the closing brace
  if (!homeCss.includes('.cx-footer .cx-brand-trident')) {
    const desktopMediaIdx = homeCss.indexOf('@media (min-width: 1025px)');
    if (desktopMediaIdx !== -1) {
      // Find the last closing brace of this media block (or append before last brace of the file if it's the end)
      const lastBraceIdx = homeCss.lastIndexOf('}');
      if (lastBraceIdx !== -1) {
        homeCss = homeCss.slice(0, lastBraceIdx) + '\n' + homeFooterScale + '\n}';
      }
    }
  }

  // Also improve baseline footer layout in homeCss
  const homeFooterBase = `
.cx-footer {
  display: grid !important;
  min-height: 135px !important;
  grid-template-columns: auto 1fr auto !important;
  align-items: center !important;
  gap: 20px 30px !important;
  padding: 36px 5vw !important;
  border-top: 1px solid rgba(255, 255, 255, .08) !important;
  background: #0b0d0a !important;
  color: #b9b8af !important;
}
.cx-footer > .cx-brand {
  grid-column: 1 !important;
  grid-row: 1 !important;
}
.cx-footer > p {
  grid-column: 2 !important;
  grid-row: 1 !important;
  margin: 0 !important;
  color: #a1a39a !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
}
.cx-footer-top,
.cx-footer > a:last-child {
  grid-column: 3 !important;
  grid-row: 1 !important;
  justify-self: end !important;
  align-self: center !important;
  color: #8b8d84 !important;
  text-decoration: none !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  white-space: nowrap !important;
  transition: color 160ms ease !important;
}
.cx-footer-top:hover,
.cx-footer > a:last-child:hover {
  color: #f4f0e4 !important;
}
.cx-footer > nav {
  grid-column: 1 / -1 !important;
  grid-row: 2 !important;
  position: static !important;
  z-index: auto !important;
  display: flex !important;
  justify-content: center !important;
  gap: 28px !important;
  margin: 0 !important;
  padding: 18px 0 0 !important;
  flex-wrap: wrap !important;
  border-top: 1px solid rgba(255, 255, 255, .06) !important;
}
.cx-footer > nav a {
  color: #8b8d84 !important;
  text-decoration: none !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  transition: color 160ms ease !important;
}
.cx-footer > nav a:hover {
  color: #f4f0e4 !important;
}
`;

  if (!homeCss.includes('.cx-footer > nav {')) {
    homeCss = homeCss.replace('.cx-footer{color:#b9b8af;', homeFooterBase + '\n.cx-footer{color:#b9b8af;');
  }

  fs.writeFileSync(homeCssPath, homeCss, 'utf8');
  console.log('✅ Updated site-next/app/cinematic.css');
}

// 3. UPDATE cinematic-site/shared-footer.css
const sharedPath = 'cinematic-site/shared-footer.css';
if (fs.existsSync(sharedPath)) {
  let sharedCss = fs.readFileSync(sharedPath, 'utf8').replace(/\r\n/g, '\n');

  const sharedFluidScale = `
/* ==========================================================================
   ESCALA FLUIDA PADRONIZADA COM A PAGINA INICIAL (1025px+)
   ========================================================================== */
@media (min-width: 1025px) {
  .axe-site-header {
    width: min(1480px, calc(100% - clamp(32px, 3.5vw, 64px))) !important;
    height: clamp(66px, 4.2vw, 78px) !important;
    padding: 0 clamp(16px, 1.6vw, 28px) !important;
    gap: clamp(20px, 2vw, 36px) !important;
    border-radius: clamp(10px, 0.8vw, 14px) !important;
  }
  .axe-site-brand {
    gap: clamp(8px, 0.8vw, 12px) !important;
  }
  .axe-site-brand img {
    width: clamp(38px, 2.5vw, 46px) !important;
    height: clamp(48px, 3.2vw, 58px) !important;
  }
  .axe-site-brand strong {
    font-size: clamp(15px, 1.05vw, 18px) !important;
  }
  .axe-site-nav {
    gap: clamp(22px, 2vw, 36px) !important;
  }
  .axe-site-nav a {
    font-size: clamp(13px, 0.9vw, 15px) !important;
    font-weight: 700 !important;
  }
  .axe-site-contact {
    height: clamp(40px, 2.7vw, 46px) !important;
    padding: 0 clamp(14px, 1.1vw, 20px) !important;
    font-size: clamp(12px, 0.82vw, 14px) !important;
    border-radius: 8px !important;
  }
  .axe-site-login {
    font-size: clamp(13px, 0.88vw, 15px) !important;
    padding: 10px 8px !important;
  }
  .axe-site-cta {
    height: clamp(44px, 3vw, 50px) !important;
    padding: 0 clamp(18px, 1.4vw, 26px) !important;
    font-size: clamp(13px, 0.9vw, 15px) !important;
    border-radius: 8px !important;
    gap: clamp(8px, 0.7vw, 12px) !important;
  }
  .axe-site-footer {
    padding: clamp(36px, 3.5vw, 56px) clamp(32px, 4vw, 64px) !important;
  }
  .axe-site-footer-main {
    width: min(1480px, 100%) !important;
    gap: clamp(24px, 2.5vw, 40px) !important;
  }
  .axe-site-footer-brand img {
    width: clamp(38px, 2.5vw, 46px) !important;
    height: clamp(48px, 3.2vw, 58px) !important;
  }
  .axe-site-footer-brand strong {
    font-size: clamp(15px, 1.05vw, 18px) !important;
  }
  .axe-site-footer-main > p {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
  .axe-site-footer nav {
    gap: clamp(20px, 2vw, 36px) !important;
  }
  .axe-site-footer nav a {
    font-size: clamp(13px, 0.9vw, 15px) !important;
  }
  .axe-site-footer-bottom {
    width: min(1480px, 100%) !important;
    font-size: clamp(11px, 0.75vw, 13px) !important;
  }
}
`;

  if (!sharedCss.includes('ESCALA FLUIDA PADRONIZADA COM A PAGINA INICIAL')) {
    sharedCss += '\n' + sharedFluidScale;
  }

  fs.writeFileSync(sharedPath, sharedCss, 'utf8');
  console.log('✅ Updated cinematic-site/shared-footer.css');
}
