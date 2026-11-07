import fs from 'fs';

const files = [
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
];

for (const file of files) {
  if (fs.existsSync(file)) {
    const c = fs.readFileSync(file, 'utf-8');
    const r3 = (c.match(/rounded-3xl/g) || []).length;
    const r2 = (c.match(/rounded-2xl/g) || []).length;
    console.log(`${file}: rounded-3xl=${r3}, rounded-2xl=${r2}`);
  }
}
