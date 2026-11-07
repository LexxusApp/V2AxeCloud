import fs from 'node:fs';
import path from 'node:path';
import {loadingStyles,loadingMarkup} from '../cloudflare/pilot-loading.js';
export function loadingDocument(script,title){return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#133a2c"><meta name="robots" content="noindex,nofollow"><link rel="manifest" href="/manifest.webmanifest"><title>${title}</title><style>${loadingStyles}</style></head><body><div id="root">${loadingMarkup}</div><script type="module" src="${script}"></script></body></html>`;}
export function preloadPanel(dir,prefix){
 let assets=[];
 try{
  const indexJs=fs.readdirSync(path.join(dir,'assets')).find(name=>/^index-[\w-]+\.js$/.test(name));
  if(indexJs){
   const code=fs.readFileSync(path.join(dir,'assets',indexJs),'utf8');
   const match=code.match(/__vite__mapDeps=.*?\[(.*?)]/);
   if(match){assets=JSON.parse('['+match[1]+']').map(d=>d.replace(/^assets\//,''));}
  }
 }catch{}
 if(!assets.length){assets=fs.readdirSync(path.join(dir,'assets')).filter(name=>/^main-[\w-]+\.(js|css)$/.test(name));}
 const links=assets.map(name=>{
  if(name.endsWith('.js'))return `<link rel="modulepreload" href="${prefix}assets/${name}">`;
  if(name.endsWith('.css'))return `<link rel="stylesheet" href="${prefix}assets/${name}" crossorigin>`;
  return '';
 }).filter(Boolean).join('');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('</head>',links+'</head>'));
}
