/**
 * Regenera favicon.ico e PNGs 48/96 a partir de public/axecloud_192.png.
 * Uso: node scripts/generate-favicons.mjs
 * Requer: npx sharp-cli (baixado sob demanda) e pacote to-ico.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCE = path.join(PUBLIC, 'axecloud_192.png');

if (!fs.existsSync(SOURCE)) {
  throw new Error(`Fonte ausente: ${SOURCE}`);
}

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
}

run(`npx --yes sharp-cli resize 48 48 -i "${SOURCE}" -o "${path.join(PUBLIC, 'axecloud_48.png')}"`);
run(`npx --yes sharp-cli resize 96 96 -i "${SOURCE}" -o "${path.join(PUBLIC, 'axecloud_96.png')}"`);

const toIco = (await import('to-ico')).default;
const png48 = fs.readFileSync(path.join(PUBLIC, 'axecloud_48.png'));
fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), await toIco([png48]));

console.log('[favicons] favicon.ico, axecloud_48.png, axecloud_96.png atualizados');
