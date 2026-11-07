import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('pilot deployment locks interface and operation rollout independently',()=>{
 const config=JSON.parse(fs.readFileSync('wrangler.pilot-interface.jsonc','utf8'));
 assert.equal(config.vars.INTERFACE_ROLLOUT_MODE,'pilot');
 assert.equal(config.vars.PILOT_OPERATION_ROLLOUT_MODE,'pilot');
 const deploy=fs.readFileSync('scripts/deploy-pilot-interface.mjs','utf8');
 assert.match(deploy,/Deployment safety check failed/);
 assert.match(deploy,/workers\/scripts\/.*\/settings/);
});

test('browser verification scripts require credentials from the environment',()=>{
 for(const file of [
  'scripts/final-verification.mjs',
  'scripts/verify-full-suite.mjs',
  'scripts/verify-live-production.mjs',
  'scripts/verify-prod-live-status.mjs',
  'scripts/verify-live-prod.mjs',
  'scripts/verify-live-prod-dashboard.mjs',
 ]){
  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/AXECLOUD_E2E_EMAIL/);
  assert.match(source,/AXECLOUD_E2E_PASSWORD/);
  assert.doesNotMatch(source,/password\s*[:=]\s*['"][^'"]+['"]/i);
  assert.doesNotMatch(source,/[\w.+-]+@(gmail|yahoo)\.[\w.]+/i);
 }
});
