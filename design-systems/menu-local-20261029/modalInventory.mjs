import ts from 'typescript';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = dirname(fileURLToPath(import.meta.url)), inventory = [];
const literal = node => {
  if (!node) return '';
  if (ts.isJsxText(node)) return node.text.replace(/\s+/g, ' ').trim();
  if (ts.isJsxExpression(node)) return node.expression ? `{${node.expression.getText().replace(/\s+/g, ' ')}}` : '';
  if (ts.isStringLiteral(node)) return node.text;
  return (node.children || []).map(literal).join(' ').trim();
};
const descendants = (node, predicate) => { const found = []; const visit = child => { if (predicate(child)) found.push(child); ts.forEachChild(child, visit); }; ts.forEachChild(node, visit); return found; };
for (const file of (await readdir(base)).filter(name => name.endsWith('.tsx'))) {
  const source = ts.createSourceFile(file, await readFile(join(base, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const modals = descendants(source, node => ts.isJsxElement(node) && ['WorkflowDialog', 'Dialog.Content'].includes(node.openingElement.tagName.getText(source)));
  for (const node of modals) {
    const name = node.openingElement.tagName.getText(source);
    const titleAttr = node.openingElement.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === 'title');
    const title = titleAttr ? literal(titleAttr.initializer) : descendants(node, child => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === 'Dialog.Title').map(literal).join(' / ');
    const labels = descendants(node, child => ts.isJsxElement(child) && child.openingElement.tagName.getText(source) === 'label').map(label => label.children.filter(child => ts.isJsxText(child) || ts.isJsxExpression(child)).map(literal).join(' ').trim()).filter(Boolean);
    const controls = descendants(node, child => (ts.isJsxElement(child) && ['button', 'LocalFileField', 'LocalPdfLink'].includes(child.openingElement.tagName.getText(source))) || (ts.isJsxSelfClosingElement(child) && ['LocalFileField', 'LocalPdfLink'].includes(child.tagName.getText(source)))).map(literal).filter(Boolean);
    inventory.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, title, labels, controls });
  }
}
await writeFile(join(base, 'MODAL-INVENTORY.json'), JSON.stringify({ scope: 'Prévia local; contratos de informações comparados às fontes do sistema atual, sem validação de API/produção.', modalCount: inventory.length, modals: inventory }, null, 2) + '\n');
console.log(`${inventory.length} estruturas de modal catalogadas em ${new Set(inventory.map(item => item.file)).size} arquivos.`);
