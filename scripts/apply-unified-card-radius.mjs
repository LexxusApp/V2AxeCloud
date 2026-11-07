import fs from 'fs';

const targetFiles = [
  'src/components/shared/AxePageScaffold.tsx',
  'src/components/financial/SacredOverviewView.tsx',
  'src/components/financial/SacredMensalidadesView.tsx',
  'src/components/financial/CantinaView.tsx',
  'src/components/financial/SacredPixConfigView.tsx',
  'src/views/Financial.tsx',
  'src/views/Gallery.tsx',
  'src/views/Inventory.tsx',
  'src/views/Library.tsx',
  'src/views/Store.tsx',
  'src/views/Radar.tsx',
  'src/views/MinhaAssinatura.tsx',
  'src/views/Settings.tsx',
  'src/views/Support.tsx',
  'src/lib/appUiTokens.ts',
  'src/components/ui/appDemoUi.tsx'
];

let totalReplaced = 0;

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf-8');
  const original = content;

  // Replace rounded-3xl and rounded-2xl when part of card/container/panel styling
  // Cards in Tailwind typically use rounded-3xl or rounded-2xl
  content = content.replace(/\brounded-3xl\b/g, 'rounded-lg');
  content = content.replace(/\brounded-2xl\b/g, 'rounded-lg');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`Updated ${file}`);
    totalReplaced++;
  }
}

console.log(`Finished updating ${totalReplaced} files with unified rounded-lg card corners!`);
