import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viewer = readFileSync('src/components/library/AuthenticatedPdfFrame.tsx', 'utf8');
const library = readFileSync('src/views/Library.tsx', 'utf8');
const childLibrary = readFileSync('src/components/filho/FilhoLibraryExperience.tsx', 'utf8');
const appWorker = readFileSync('cloudflare/app-shell-worker.js', 'utf8');

test('biblioteca carrega PDF pelo proxy autenticado e renderiza sem iframe externo', () => {
  assert.match(viewer, /\/api\/v1\/library\/pdf-proxy/);
  assert.match(viewer, /pdfjs-dist/);
  assert.match(viewer, /getDocument/);
  assert.match(viewer, /canvas/);
  assert.doesNotMatch(viewer, /<iframe/);
  assert.match(library, /AuthenticatedPdfFrame/);
  assert.match(childLibrary, /AuthenticatedPdfFrame/);
});

test('política do site permite blob (legado) e viewer pdf.js usa proxy', () => {
  assert.match(appWorker, /frame-src 'self' blob:/);
  assert.match(viewer, /extractLibraryStoragePath/);
});
