import fs from 'fs';

const filePath = 'c:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/src/components/dashboard-berry/BerryAppShell.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const target = `<div className="sidebar-footer">
            <button
              className="btn-logout"`;

const replacement = `<div className="sidebar-footer">
            <button
              className="btn-install-pwa"
              id="installPwaBtn"
              title="Instalar aplicativo"
              aria-label="Instalar AxéCloud no dispositivo"
              type="button"
              onClick={() => {
                const event = new CustomEvent("axecloud:trigger-pwa-install");
                window.dispatchEvent(event);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span>Instalar aplicativo</span>
            </button>
            <button
              className="btn-logout"`;

const normalized = code.replace(/\r\n/g, '\n');
if (normalized.includes(target)) {
  const updated = normalized.replace(target, replacement);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log('Added btn-install-pwa successfully!');
} else {
  console.log('Target not found!');
}
