import {build} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {preloadPanel} from './pilot-loading-html.mjs';
import {createPilotBuildId,writePilotVersion} from './pilot-build-version.mjs';
import {pilotPwaPlugin} from './pilot-pwa.mjs';
const root=path.resolve('design-systems/member-pilot-20261102'),outDir=path.resolve('artifacts/pilot-release-20261101/dist/member');
const renderers={FilhoMonthlyExperience:'Monthly',FilhoGirasExperience:'Agenda',FilhoLibraryExperience:'Library',FilhoStoreExperience:'Store',FilhoNoticeExperience:'Notices',FilhoChatExperience:'Chat'};
// Only this build replaces presentation components. Original controllers, auth and
// API contracts are reused; no changes are made to the original member application.
export function memberPresentationPlugin(){return {name:'member-pilot-presentation',enforce:'pre',resolveId(source,importer){
 const name=source.replace(/\.tsx?$/,'').split('/').at(-1);
 if(renderers[name])return path.join(root,renderers[name]+'.tsx');
 if(name==='AppTopNav')return path.join(root,'pageCompat.tsx');
 if(name==='ChatThread')return path.join(root,'ChatThread.tsx');
 if(name==='Avatar'&&!importer?.replaceAll('\\','/').endsWith('/member-pilot-20261102/Avatar.tsx'))return path.join(root,'Avatar.tsx');
 if(name==='FundamentosAcervo')return path.join(root,'Foundations.tsx');
 if(name==='authenticatedFetch'&&importer&&!importer.replaceAll('\\','/').endsWith('/member-pilot-20261102/authenticatedFetch.ts'))return path.join(root,'authenticatedFetch.ts');
},transform(code,id){
 if(!/\.[jt]sx?$/.test(id))return;
 let transformed=code.replaceAll("'/pdf.worker.min.mjs'","'/assets/member-pilot-20261102/pdf.worker.min.mjs'");
 if(/(?:^|\/)(src\/views\/Library|src\/components\/library\/AuthenticatedPdfFrame|src\/lib\/libraryDownload)\.tsx?$/.test(id.replaceAll('\\','/'))){
  transformed=transformed.replaceAll('/api/v1/library/materials','/api/pilot/library/materials').replaceAll('/api/v1/library/pdf-proxy','/api/pilot/library/pdf-proxy');
 }
 if(id.replaceAll('\\','/').endsWith('/src/views/MensalidadeFilho.tsx'))transformed=transformed.replace(/<FilhoMonthlyExperience\s/,'<FilhoMonthlyExperience loadError={loadError} ');
 return transformed===code?undefined:transformed;
}};}
export async function buildMemberPilot(requestedBuildId){
 const buildId=requestedBuildId||createPilotBuildId();
 fs.rmSync(path.join(outDir,'assets'),{recursive:true,force:true});
 fs.rmSync(path.join(outDir,'index.html'),{force:true});
 await build({configFile:false,root,base:'/assets/member-pilot-20261102/',envDir:process.cwd(),publicDir:false,define:{__PILOT_BUILD_ID__:JSON.stringify(buildId)},plugins:[memberPresentationPlugin(),pilotPwaPlugin(),react(),tailwind()],resolve:{dedupe:['react','react-dom']},build:{outDir,emptyOutDir:false,copyPublicDir:false}});
 fs.copyFileSync(path.resolve('public/trident-cropped.png'),path.join(outDir,'trident-cropped.png'));
 fs.copyFileSync(path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),path.join(outDir,'pdf.worker.min.mjs'));
 preloadPanel(outDir,'/assets/member-pilot-20261102/');
 writePilotVersion(outDir,buildId);
 console.log('Built member pilot; existing manager and original member assets preserved.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildMemberPilot();
