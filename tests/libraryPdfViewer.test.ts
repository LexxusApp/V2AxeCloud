import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viewer = readFileSync('src/components/library/AuthenticatedPdfFrame.tsx', 'utf8');
const managerViewer = readFileSync('design-systems/menu-local-20261029/LibraryPdf.tsx', 'utf8');
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

test('visualizador de PDF possui controles de zoom, tela cheia e altura responsiva ampla', () => {
  assert.match(viewer, /ZoomIn/);
  assert.match(viewer, /ZoomOut/);
  assert.match(viewer, /Maximize2/);
  assert.match(viewer, /Minimize2/);
  assert.match(viewer, /isFullscreen/);
  assert.match(viewer, /fixed inset-0/);
  assert.doesNotMatch(library, /aspect-\[16\/9\]/);
  assert.match(library, /min-h-\[520px\]/);
});

test('visualizador mede a tela antes de montar páginas e não anima dimensões do canvas', () => {
  assert.match(viewer, /useState<number>\(0\)/);
  assert.match(viewer, /requestAnimationFrame/);
  assert.match(viewer, /Math\.abs\(current - measured\) < 12/);
  assert.match(viewer, /containerWidth <= 0 \?/);
  assert.match(viewer, /canvas\.style\.height = `\$\{displayHeight\}px`/);
  assert.match(viewer, /style=\{\{ width: `\$\{displayWidth\}px`, height: `\$\{displayHeight\}px` \}\}/);
  assert.match(viewer, /Promise\.all\(/);
  assert.match(viewer, /\[isFullscreen, pdf\]/);
  assert.doesNotMatch(viewer, /transition-all/);
});

test('leitor do zelador valida a resposta e troca páginas sem piscar ou recalcular continuamente', () => {
  assert.match(managerViewer, /useState\(0\)/);
  assert.match(managerViewer, /requestAnimationFrame/);
  assert.match(managerViewer, /Math\.abs\(current - next\) < 12/);
  assert.match(managerViewer, /new TextDecoder\(\)\.decode\(bytes\.slice\(0, 5\)\) !== '%PDF-'/);
  assert.match(managerViewer, /document\.createElement\('canvas'\)/);
  assert.match(managerViewer, /visible\.drawImage\(buffer, 0, 0\)/);
  assert.match(managerViewer, /isEvalSupported: false/);
  assert.doesNotMatch(managerViewer, /useState\(600\)/);
});

