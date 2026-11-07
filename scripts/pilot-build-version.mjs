import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function createPilotBuildId() {
  return `pilot-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

export function writePilotVersion(outDir, buildId) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'pilot-version.json'),
    JSON.stringify({ buildId, publishedAt: new Date().toISOString() }),
  );
}
