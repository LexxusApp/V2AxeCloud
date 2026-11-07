import fs from 'fs';

const cssPath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/dashboard-berry/berry-dashboard.css';
let css = fs.readFileSync(cssPath, 'utf8');

const target = `/* Tipografia Base Estilo Berry */
h1, h2, h3, h4, h5, h6 {
  font-family: 'Inter', sans-serif;
  letter-spacing: -0.025em;
  color: var(--text-main);
  margin-top: 0;
}

h1 { font-size: 2.125rem; font-weight: 700; line-height: 1.2; }
h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.25; }
h3 { font-size: 1.25rem; font-weight: 650; line-height: 1.3; }
h4 { font-size: 1rem; font-weight: 650; line-height: 1.35; }
h5 { font-size: 0.875rem; font-weight: 600; line-height: 1.4; }
h6 { font-size: 0.75rem; font-weight: 600; line-height: 1.4; }

p, span, small {
  font-family: 'Inter', sans-serif;
}`;

const replacement = `/* Tipografia Base Estilo Berry - Escopo Restrito ao Dashboard */
.dashboard-main-content h1, 
.dashboard-main-content h2, 
.dashboard-main-content h3, 
.dashboard-main-content h4, 
.dashboard-main-content h5, 
.dashboard-main-content h6 {
  font-family: 'Inter', sans-serif;
  letter-spacing: -0.025em;
  margin-top: 0;
}

.dashboard-main-content h1 { font-size: 2.125rem; font-weight: 700; line-height: 1.2; }
.dashboard-main-content h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.25; }
.dashboard-main-content h3 { font-size: 1.25rem; font-weight: 650; line-height: 1.3; }
.dashboard-main-content h4 { font-size: 1rem; font-weight: 650; line-height: 1.35; }
.dashboard-main-content h5 { font-size: 0.875rem; font-weight: 600; line-height: 1.4; }
.dashboard-main-content h6 { font-size: 0.75rem; font-weight: 600; line-height: 1.4; }

.dashboard-main-content p, 
.dashboard-main-content span, 
.dashboard-main-content small {
  font-family: 'Inter', sans-serif;
}`;

const normalized = css.replace(/\r\n/g, '\n');
if (normalized.includes(target)) {
  const updated = normalized.replace(target, replacement);
  fs.writeFileSync(cssPath, updated, 'utf8');
  console.log('Scoped heading typography to .dashboard-main-content successfully!');
} else {
  console.log('Target not found in berry-dashboard.css!');
}
