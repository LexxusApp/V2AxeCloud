import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
const account='7dc3269da8b17406d305a21ac9d2efee';
const cli='C:/Users/Lucas A/AppData/Local/npm-cache/_npx/a0914b0866aa515d/node_modules/wrangler/bin/wrangler.js';
const dir=path.resolve('artifacts/pilot-release-20261101');
const auth=JSON.parse(execFileSync(process.execPath,[cli,'auth','token','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const headers={Authorization:'Bearer '+(auth.token??auth.api_token??auth.oauth_token)};
async function cf(endpoint,options={}){const response=await fetch('https://api.cloudflare.com/client/v4'+endpoint,{...options,headers:{...headers,...options.headers}});const data=await response.json();if(!response.ok||data.success===false)throw Error('Cloudflare '+response.status+': '+JSON.stringify(data.errors||[]));return data.result;}
const config=JSON.parse(fs.readFileSync('wrangler.pilot-interface.jsonc','utf8'));
const expectedRollout={INTERFACE_ROLLOUT_MODE:config.vars?.INTERFACE_ROLLOUT_MODE,PILOT_OPERATION_ROLLOUT_MODE:config.vars?.PILOT_OPERATION_ROLLOUT_MODE,MEMBER_INTERFACE_ROLLOUT_MODE:config.vars?.MEMBER_INTERFACE_ROLLOUT_MODE,MEMBER_OPERATION_ROLLOUT_MODE:config.vars?.MEMBER_OPERATION_ROLLOUT_MODE};
for(const name of ['INTERFACE_ROLLOUT_MODE','PILOT_OPERATION_ROLLOUT_MODE'])if(!['pilot','managers'].includes(expectedRollout[name]))throw Error('Refusing deployment: '+name+' must be explicitly set to pilot or managers.');
for(const name of ['MEMBER_INTERFACE_ROLLOUT_MODE','MEMBER_OPERATION_ROLLOUT_MODE'])if(!['pilot','members'].includes(expectedRollout[name]))throw Error('Refusing deployment: '+name+' must be explicitly set to pilot or members.');
const zones=await cf('/zones?name=axecloud.com.br');if(zones.length!==1)throw Error('Expected one zone');const zone=zones[0].id;
const routesBefore=await cf('/zones/'+zone+'/workers/routes');
for(const route of config.routes){const existing=routesBefore.find(item=>item.pattern===route.pattern);if(existing&&existing.script!==config.name)throw Error('Refusing to replace existing route: '+route.pattern);}
const current=await cf('/accounts/'+account+'/workers/scripts/axecloud-app-assets/deployments');
const liveBuild=await(await fetch('https://axecloud.com.br/build-info.json',{cache:'no-store'})).json();
fs.writeFileSync(path.join(dir,'production-before.json'),JSON.stringify({appDeployment:current,build:liveBuild,routes:routesBefore},null,2));
function deploy(configFile,label){const run=spawnSync(process.execPath,[cli,'deploy','--config',configFile,'--keep-vars'],{encoding:'utf8',maxBuffer:5e6,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});fs.writeFileSync(path.join(dir,label+'.log'),run.stdout+run.stderr);if(run.status)throw Error((run.stdout+run.stderr).slice(-6000));console.log((run.stdout+run.stderr).split('\n').filter(line=>/Uploaded|Deployed|Current Version|Total Upload|routes:/.test(line)).join('\n'));}
const staged={...config,main:path.resolve(config.main),assets:{...config.assets,directory:path.resolve(config.assets.directory)},$schema:undefined,routes:[]};
const stagedFile=path.join(dir,'wrangler.staged.json');fs.writeFileSync(stagedFile,JSON.stringify(staged,null,2));
if(!process.argv.includes('--update'))deploy(stagedFile,'stage');
const secrets=await cf('/accounts/'+account+'/workers/scripts/'+config.name+'/secrets');
if(!secrets.some(item=>item.name==='PILOT_COOKIE_SECRET'))await cf('/accounts/'+account+'/workers/scripts/'+config.name+'/secrets',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'PILOT_COOKIE_SECRET',type:'secret_text',text:crypto.randomBytes(48).toString('base64url')})});
deploy(path.resolve('wrangler.pilot-interface.jsonc'),'activate');
const settings=await cf('/accounts/'+account+'/workers/scripts/'+config.name+'/settings');
const plainVariables=Object.fromEntries((settings.bindings||[]).filter(binding=>binding.type==='plain_text').map(binding=>[binding.name,binding.text]));
for(const [name,value] of Object.entries(expectedRollout))if(plainVariables[name]!==value)throw Error('Deployment safety check failed: '+name+' is not locked to pilot.');
const after=await cf('/accounts/'+account+'/workers/scripts/axecloud-app-assets/deployments');
if(JSON.stringify(current)!==JSON.stringify(after))throw Error('The current application changed during publication. Review deployment before proceeding.');
const routesAfter=await cf('/zones/'+zone+'/workers/routes');
if(routesBefore.some(old=>old.script!==config.name&&!routesAfter.some(row=>row.id===old.id&&row.script===old.script&&row.pattern===old.pattern)))throw Error('An existing route changed unexpectedly.');
if(config.routes.some(expected=>!routesAfter.some(row=>row.pattern===expected.pattern&&row.script===config.name)))throw Error('A pilot route was not installed.');
const buildAfter=await(await fetch('https://axecloud.com.br/build-info.json',{cache:'no-store'})).json();
if(JSON.stringify(liveBuild)!==JSON.stringify(buildAfter))throw Error('Current production build changed.');
fs.writeFileSync(path.join(dir,'production-after.json'),JSON.stringify({appDeployment:after,build:buildAfter,routes:routesAfter},null,2));
console.log(`Interface published in ${expectedRollout.INTERFACE_ROLLOUT_MODE} manager mode and ${expectedRollout.MEMBER_INTERFACE_ROLLOUT_MODE} member mode, with matching operation access. Original application deployment, assets build and all existing routes were preserved.`);
