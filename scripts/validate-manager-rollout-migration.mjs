import * as dotenv from 'dotenv';
import { readFileSync } from 'node:fs';

dotenv.config({ path: '.env' });

const project = String(process.env.SUPABASE_PROJECT_REF || 'vlaojhfwhqmwudqsumpi').trim();
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN não configurado.');

const migrationPath = process.argv[2] || 'artifacts/release-audit-20261103/general-rollout/20261104110000_manager_interface_authorization.sql';
const validationPath = process.argv[3] || 'tests/managerInterfaceAuthorization.validation.sql';
const migration = readFileSync(migrationPath, 'utf8')
  .replace(/^\s*begin\s*;/i, '')
  .replace(/commit\s*;\s*$/i, '');
const validation = readFileSync(validationPath, 'utf8');
const query = `begin;\n${migration}\n${validation}\nrollback;`;

const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
const body = await response.text();
if (!response.ok) throw new Error(`Validação SQL falhou (${response.status}): ${body.slice(0, 1200)}`);
if (!body.includes('manager_interface_authorization_validation') || !body.includes('passed')) {
  throw new Error('O banco não retornou a confirmação esperada da validação transacional.');
}
console.log('Manager rollout migration validation passed; transaction rolled back.');
