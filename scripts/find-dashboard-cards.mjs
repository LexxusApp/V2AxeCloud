import fs from 'fs';
import path from 'path';

function search(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'node_modules' && f.name !== 'dist') search(full);
    else if (f.isFile() && (f.name.endsWith('.tsx') || f.name.endsWith('.ts') || f.name.endsWith('.css'))) {
      const c = fs.readFileSync(full, 'utf-8');
      if (c.includes('.hero-welcome-card') || c.includes('hero-welcome-card {') || c.includes('border-radius') && c.includes('hero-welcome-card')) {
        console.log('Found CSS in:', full);
      }
    }
  }
}

search('src');
