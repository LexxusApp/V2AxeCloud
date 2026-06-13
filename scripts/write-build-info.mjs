import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let gitSha = 'local';
try {
  gitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {
  /* fora de repo git */
}

const buildId = `${gitSha}-${Date.now()}`;
const payload = { buildId, builtAt: new Date().toISOString() };

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'build-info.json'), JSON.stringify(payload), 'utf8');

console.log(`[build-info] ${buildId}`);
