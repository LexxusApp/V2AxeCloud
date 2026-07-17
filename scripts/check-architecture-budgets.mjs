import { readFileSync } from 'node:fs';

const budgets = [
  { file: 'api/index.ts', maxLines: 5264, maxRoutes: 89 },
  { file: 'server.ts', maxLines: 4701, maxRoutes: 73 },
  { file: 'src/App.tsx', maxLines: 1490 },
];

let failed = false;

for (const budget of budgets) {
  const source = readFileSync(budget.file, 'utf8');
  const lines = source.trimEnd().split(/\r?\n/).length;
  const routes = (source.match(/\bapp\.(?:get|post|put|patch|delete)\s*\(/g) || []).length;
  const details = [`${lines}/${budget.maxLines} linhas`];

  if (budget.maxRoutes != null) {
    details.push(`${routes}/${budget.maxRoutes} rotas`);
  }

  const overLines = lines > budget.maxLines;
  const overRoutes = budget.maxRoutes != null && routes > budget.maxRoutes;
  if (overLines || overRoutes) failed = true;

  console.log(`[architecture] ${overLines || overRoutes ? 'FALHOU' : 'OK'} ${budget.file}: ${details.join(', ')}`);
}

if (failed) {
  console.error(
    '[architecture] Arquivo concentrador cresceu. Extraia responsabilidades para um módulo de domínio antes de adicionar código.',
  );
  process.exitCode = 1;
}
