import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {subscriptionFromServer} from '../design-systems/menu-local-20261029/subscription';

const path='design-systems/menu-local-20261029/';
const component=readFileSync(path+'SubscriptionPage.tsx','utf8');
const dialog=readFileSync(path+'SubscriptionPixDialog.tsx','utf8');
const service=readFileSync(path+'remote/subscriptionPix.ts','utf8');
const backend=readFileSync('api/lib/efiCheckoutRoutes.ts','utf8');
const pricing={amountCents:600,pixAvailable:true,cardAvailable:false,sandbox:false};
const tenant='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
const model=subscriptionFromServer(tenant,
 {id:tenant,plan:'premium',billing_cycle:'monthly',status:'active'},
 {tenantId:tenant,active:true,billingCycle:'monthly'},
 pricing,{...pricing,amountCents:6000}
);

test('renewal stays on subscription page and immediately opens a Pix dialog',()=>{
 assert.match(component,/setPixOpen\(true\)/);
 assert.match(component,/SubscriptionPixDialog/);
 assert.doesNotMatch(component,/window\.location\.(assign|replace)/);
 assert.doesNotMatch(component,/Continuar para pagamento/);
 assert.doesNotMatch(component,/Revisar renovação/);
 assert.match(component,/selected\.pixAvailable \?\? selected\.available/);
});
test('Pix generator uses authenticated tenant, server pricing and renewal purpose, not client price',()=>{
 assert.equal(model.pricing.monthly.cents,600);
 assert.equal(model.pricing.annual.cents,6000);
 assert.equal(model.pricing.monthly.pixAvailable,true);
 assert.match(service,/scoped\('\/api\/v1\/checkout\/efi\/pix'\), 'POST'/);
 assert.match(service,/purpose: 'renewal'/);
 assert.match(service,/previewSession\(\)\.tenantId !== tenantId/);
 assert.doesNotMatch(service,/amountCents\s*:/);
 assert.match(backend,/checkoutRateLimit/);
 assert.match(backend,/resolvePremiumOnboardingAmountCents/);
});
test('confirmation requires real provider status and refresh, never browser assertion',()=>{
 assert.match(dialog,/checkRenewalPixStatus\(tenantId, charge\.txid\)/);
 assert.match(dialog,/if \(result\.paid\)/);
 assert.match(dialog,/await onRefresh\(\)/);
 assert.match(dialog,/window\.setInterval/);
 assert.match(dialog,/window\.clearInterval/);
 assert.doesNotMatch(dialog,/setInterval\([^)]*onRefresh/);
});
test('copy and paste stays in dialog, with protected status and sandbox messaging',()=>{
 assert.match(dialog,/navigator\.clipboard\.writeText\(charge\.copyPaste\)/);
 assert.match(dialog,/textarea[^>]*readOnly/);
 assert.match(dialog,/charge\.qrCodeDataUrl/);
 assert.match(dialog,/price\.sandbox/);
 assert.match(dialog,/recurring/);
 assert.match(dialog,/aria-label|alt="QR Code Pix/);
});
test('deployment stage changes only subscription chunk, stylesheet and version',()=>{
 const original='artifacts/subscription-pix-baseline/dist/assets/';
 const staged='artifacts/subscription-pix-selective/dist/assets/';
 const source=readdirSync(original).find(x=>x.startsWith('SubscriptionPage-')&&x.endsWith('.js'));
 assert.ok(source);
 const oldCode=readFileSync(original+source,'utf8');
 const code=readFileSync(staged+source,'utf8');
 assert.notEqual(code,oldCode);
 assert.match(code,/\/api\/v1\/checkout\/efi\/pix/);
 assert.match(code,/main-CupOkX_i\.js/);
 const originalMain = readFileSync(original+'main-CupOkX_i.js','utf8');
 const stagedMain = readFileSync(staged+'main-CupOkX_i.js','utf8');
 const oldVersion = JSON.parse(readFileSync('artifacts/subscription-pix-baseline/dist/pilot-version.json','utf8'));
 const newVersion = JSON.parse(readFileSync('artifacts/subscription-pix-selective/dist/pilot-version.json','utf8'));
 assert.equal(stagedMain, originalMain.replace(oldVersion.buildId,newVersion.buildId));
});
