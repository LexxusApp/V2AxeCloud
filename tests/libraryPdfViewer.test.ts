import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const reader=readFileSync('src/components/library/PdfReader.tsx','utf8');
const frame=readFileSync('src/components/library/AuthenticatedPdfFrame.tsx','utf8');
const manager=readFileSync('design-systems/menu-local-20261029/LibraryPdf.tsx','utf8');
test('ambas as bibliotecas usam o leitor compartilhado com proxy autenticado',()=>{
 assert.match(frame,/\/api\/v1\/library\/pdf-proxy/);
 assert.match(frame,/path && !tenantId/);
 assert.match(frame,/PdfReader/);
 assert.match(manager,/components\/library\/PdfReader/);
 assert.match(readFileSync('src/views/Library.tsx','utf8'),/AuthenticatedPdfFrame/);
 assert.match(readFileSync('src/components/filho/FilhoLibraryExperience.tsx','utf8'),/AuthenticatedPdfFrame/);
});
test('PDF permanece na origem e scripts internos do documento não são habilitados',()=>{
 assert.match(reader,/readPdfBytes\(source, \{ signal: abort.signal, storagePath, tenantId \}\)/);
 assert.match(reader,/pdfjs-dist\/build\/pdf.worker.min.mjs\?url/);
 assert.doesNotMatch(reader,/<iframe|PDFScriptingManager|https:\/\//);
 assert.match(reader,/enableXfa: false/);
});
test('desmontagem cancela download e libera documento e observadores',()=>{
 assert.match(reader,/abort.abort\(\)/);
 assert.match(reader,/observer\?\.disconnect\(\)/);
 assert.match(reader,/task.destroy\(\)/);
 assert.match(reader,/viewer\?\.setDocument\(null!\)/);
});
