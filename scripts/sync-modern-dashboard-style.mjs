// Copy only the approved visual rules, never the prototype's state or actions.
import fs from 'node:fs/promises';
import postcss from 'postcss';
const source = 'design-systems/menu-local-20261029/dashboard.css';
const root = postcss.parse(await fs.readFile(source, 'utf8'));
const scope = '.modern-app .modern-dashboard';
root.walkRules(rule => {
  if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(selector => selector.includes('.dashboard-stage')
    ? selector.replace(/\.dashboard-stage/g, scope) : `${scope} ${selector}`);
});
const reset = `/* Visual reference: localhost:5188, dashboard.css. Generated scoped copy. */
${scope} { font-family: Inter, sans-serif; letter-spacing: -.011em; }
${scope} :is(h1,h2,h3,p,ol) { margin: 0; text-shadow: none; filter: none; }
${scope} :is(h1,h2,h3) { font-family: inherit!important; }
${scope} button { border: 0; font-family: inherit; color: inherit; letter-spacing: inherit; background: transparent; box-shadow: none; }
`;
const additions = `
${scope} .d-page-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin: 0 0 8px; }
${scope} .d-page-heading h1 { font-size: 34px; line-height: 1.3; font-weight: 600; letter-spacing: -.035em; color: #223b2c; }
${scope} .d-page-heading p { color: #626f5d; font-size: 14px; line-height: 1.7; margin-top: 9px; }
${scope} .d-page-heading > div:last-child { display: flex; align-items: center; gap: 22px; }
${scope} .d-page-heading time { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #626f5d; white-space: nowrap; }
${scope} .d-member-avatar { height: 28px; width: 28px; border-radius: 50%; border: 2px solid #173025; font-size: 10px; }
${scope} .d-refresh-state { font-size: 12px; color: #626f5d; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
${scope} .d-refresh-state button { color: #355b2a; text-decoration: underline; min-height: 44px; }
${scope} .d-action:disabled { opacity: .65; cursor: wait; }
${scope} .d-action, ${scope} .d-welcome-actions .d-action, ${scope} .d-filter button, ${scope} .d-setup-steps button, ${scope} .d-text-link { min-height: 44px; }
${scope} .d-preceito .d-action { flex-shrink: 0; }
@media(max-width:1100px) { ${scope} .d-page-heading time { display: none; } }
@media(max-width:640px) { ${scope} .d-page-heading { display: block; } ${scope} .d-page-heading h1 { font-size: 28px; } ${scope} .d-page-heading p { font-size: 13px; } ${scope} .d-page-heading > div:last-child { margin-top: 18px; } }
.modern-movement-dialog { position: fixed; z-index: 181; inset: 50% auto auto 50%; transform: translate(-50%,-50%); width: min(480px,calc(100vw - 32px)); max-height: 88dvh; overflow-y: auto; padding: 26px; border-radius: 16px; background: #fff; color: #223b2c; font-family: Inter,sans-serif; box-shadow: 0 20px 60px -15px #102b2340; }
.modern-movement-dialog > p { color: #626f5d; font-size: 13px; line-height: 1.7; margin: 8px 0 20px; }
.modern-movement-options { display: grid; gap: 8px; }
.modern-movement-options > button { display: flex; align-items: center; gap: 14px; border: 0; padding: 16px 12px; border-radius: 10px; background: #f3f6ef; color: #284b36; text-align: left; cursor: pointer; font: inherit; }
.modern-movement-options > button > span { flex: 1; min-width: 0; }
.modern-movement-options strong,.modern-movement-options small { display: block; }
.modern-movement-options strong { font-size: 14px; font-weight: 600; }
.modern-movement-options small { font-size: 12px; color: #626f5d; line-height: 1.6; margin-top: 5px; }
.modern-movement-dialog button:focus-visible { outline: 3px solid #a77b1c; outline-offset: 2px; }
`;
await fs.writeFile('src/components/dashboard/modern-dashboard.css', reset + root.toString() + additions);
