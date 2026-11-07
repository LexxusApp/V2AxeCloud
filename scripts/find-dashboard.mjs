import fs from 'fs';
import path from 'path';

function search(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'node_modules' && f.name !== 'dist') search(full);
    else if (f.isFile() && (f.name.endsWith('.tsx') || f.name.endsWith('.ts'))) {
      const c = fs.readFileSync(full, 'utf-8');
      if (c.includes('PAINEL DA ZELADORIA') || c.includes('Boa noite') || c.includes('Gira de Caboclo') || c.includes('PRECEITO LIT')) {
        console.log('Found in:', full);
      }
    }
  }
}

search('src');
