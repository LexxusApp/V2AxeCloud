import {build} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import {preloadPanel} from './pilot-loading-html.mjs';
import {createPilotBuildId,writePilotVersion} from './pilot-build-version.mjs';
const root=path.resolve('design-systems/menu-local-20261029');
const outDir=path.resolve('artifacts/pilot-release-20261101/dist');
const prefix='/assets/pilot-20261101/';
const buildId=createPilotBuildId();
const publicFiles=['trident-cropped.png','dashboard/gira-caboclo.webp','dashboard/command-forest.webp'];
// Manager and member bundles live in separate directories. Clear only the
// manager output so old chunks and retired prototype assets cannot be
// published by a later pilot deployment.
fs.rmSync(path.join(outDir,'assets'),{recursive:true,force:true});
fs.rmSync(path.join(outDir,'index.html'),{force:true});
const pilotAssets={name:'pilot-public-assets',enforce:'pre',transform(code,id){if(!id.replaceAll('\\','/').startsWith(root.replaceAll('\\','/'))||!/[.](?:tsx?|css)$/.test(id))return;for(const file of publicFiles)code=code.replaceAll('/'+file,prefix+file);return code;}};
await build({configFile:false,root,base:prefix,envDir:process.cwd(),publicDir:false,define:{__PILOT_BUILD_ID__:JSON.stringify(buildId)},plugins:[pilotAssets,react()],resolve:{dedupe:['react','react-dom']},build:{outDir,emptyOutDir:false,copyPublicDir:false}});
for(const file of publicFiles){const destination=path.join(outDir,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.resolve('public',file),destination);}
const entry=path.join(outDir,'index.html');
fs.writeFileSync(entry,fs.readFileSync(entry,'utf8').replace('AxéCloud | Protótipo local','AxéCloud | Piloto exclusivo'));
preloadPanel(outDir,prefix);
writePilotVersion(outDir,buildId);
console.log('Built the original 5188 interface; existing application assets were not rebuilt.');
await (await import('./build-member-pilot.mjs')).buildMemberPilot(buildId);
