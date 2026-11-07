import fs from 'fs';

function glob(dir) {
  let results = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(ent => {
    const p = dir + '/' + ent.name;
    if (ent.isDirectory() && !p.includes('node_modules') && !p.includes('.git') && !p.includes('dist')) {
      results = results.concat(glob(p));
    } else if (ent.isFile() && (p.endsWith('.tsx') || p.endsWith('.ts'))) {
      results.push(p);
    }
  });
  return results;
}

const files = glob('src');
const modalFiles = [];
files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  if (code.includes('BodyPortal') || code.includes('aria-modal') || code.includes('role="dialog"') || code.includes('Dialog.Portal') || code.includes('Dialog.Root')) {
    modalFiles.push(f);
  }
});

console.log(`Auditing ${modalFiles.length} files with modals/dialogs:`);
let issues = 0;
modalFiles.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  const hasFixedInset = code.includes('fixed inset-0') || code.includes('fixed inset-y-0');
  const hasZIndex = code.includes('z-[') || code.includes('z-50') || code.includes('z-40') || code.includes('z-30');
  const status = hasFixedInset && hasZIndex ? '✅ OK' : '⚠️ CHECK';
  if (status.includes('CHECK')) issues++;
  console.log(`${status} ${f} (fixedInset: ${hasFixedInset}, zIndex: ${hasZIndex})`);
});

console.log(`\nAudit finished with ${issues} potential issues.`);
