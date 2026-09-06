import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viewer = readFileSync('src/components/library/AuthenticatedPdfFrame.tsx', 'utf8');
const library = readFileSync('src/views/Library.tsx', 'utf8');
const childLibrary = readFileSync('src/components/filho/FilhoLibraryExperience.tsx', 'utf8');
const caddy = readFileSync('deploy/Caddyfile', 'utf8');

test('biblioteca carrega PDF pelo proxy autenticado antes de exibir', () => {
  assert.match(viewer, /\/api\/v1\/library\/pdf-proxy/);
  assert.match(viewer, /URL\.createObjectURL/);
  assert.match(viewer, /URL\.revokeObjectURL/);
  assert.match(library, /AuthenticatedPdfFrame/);
  assert.match(childLibrary, /AuthenticatedPdfFrame/);
});

test('política do site permite o endereço temporário protegido do PDF', () => {
  assert.match(caddy, /frame-src 'self' blob:/);
});
