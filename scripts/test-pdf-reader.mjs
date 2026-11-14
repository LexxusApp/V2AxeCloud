import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import PDFDocument from 'pdfkit';
import { chromium } from 'playwright';
import { pdfAssetsPlugin } from './vite-plugin-pdf-assets.mjs';

const root = path.resolve('artifacts/pdf-reader-test');
await fs.mkdir(root, { recursive: true });
const pdf = new PDFDocument({ autoFirstPage: false });
const chunks = [];
pdf.on('data', chunk => chunks.push(chunk));
const done = new Promise(resolve => pdf.on('end', resolve));
for (let i = 1; i <= 130; i++) {
  pdf.addPage({ size: 'A4', layout: i === 3 ? 'landscape' : 'portrait' });
  pdf.fontSize(28).text(`Acervo de estudos - pagina ${i}`, 60, 70);
  pdf.fontSize(15).text(i === 1 ? 'Documento de teste do leitor AxéCloud.' : `Conhecimento compartilhado. Referencia ${i}.`, 60, 140);
  pdf.rect(60, 210, 300, 250).fill(i % 2 ? '#122d23' : '#e7ecdf');
}
pdf.end(); await done;
await fs.writeFile(path.join(root, 'fixture.pdf'), Buffer.concat(chunks));
await fs.writeFile(path.join(root, 'index.html'), '<html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./main.tsx"></script></html>');
await fs.writeFile(path.join(root, 'main.tsx'), `
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import * as Dialog from '@radix-ui/react-dialog';
import Reader from '../../src/components/library/PdfReader';
import '../../design-systems/menu-local-20261029/style.css';
import '../../design-systems/menu-local-20261029/library.css';
function App(){const [open,setOpen]=useState(true);const [bad,setBad]=useState(false);return <><button onClick={()=>setOpen(true)}>Abrir PDF</button><button onClick={()=>setBad(!bad)}>Trocar arquivo</button><Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay/><Dialog.Content className="lb-reader"><header><div><Dialog.Title>Acervo de estudos</Dialog.Title><Dialog.Description>Fundamentos · Toda a casa</Dialog.Description></div><Dialog.Close>Fechar leitura</Dialog.Close></header><Reader source={bad?'/invalid.pdf':'/fixture.pdf'} title="Acervo de estudos"/><footer>Arquivo do acervo</footer></Dialog.Content></Dialog.Portal></Dialog.Root></>};
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);`);
await build({ configFile:false, root, base:'/', publicDir:false, plugins:[react(),pdfAssetsPlugin()], logLevel:'warn',
  build:{ outDir:path.join(root,'dist'), emptyOutDir:true }, resolve:{dedupe:['react','react-dom']} });
await fs.copyFile(path.join(root,'fixture.pdf'),path.join(root,'dist/fixture.pdf'));
await fs.writeFile(path.join(root,'dist/invalid.pdf'),'not a pdf');
const server = await preview({ configFile:false, root, build:{outDir:path.join(root,'dist')}, preview:{host:'127.0.0.1',port:5197,strictPort:true} });
const browser = await chromium.launch({headless:true});
const failures=[];
try {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const page=await browser.newPage({viewport});
    page.on('pageerror', error=>failures.push(error.message));
    page.on('console', message=>{if(message.type()==='error') failures.push(message.text());});
    await page.goto('http://127.0.0.1:5197');
    await page.waitForSelector('.page canvas', {timeout:30000});
    await page.waitForFunction(()=>!document.querySelector('.ac-pdf-state'));
    assert.equal(await page.locator('.ac-pdf-status').textContent().then(t=>t.includes('de 130')),true);
    const fit=await page.locator('[aria-label="Ajuste de zoom"]').inputValue();
    assert.equal(fit,viewport.width<600?'page-width':'page-fit');
    const geometry=await page.evaluate(()=>{
      const host=document.querySelector('.ac-pdf-scroll').getBoundingClientRect();
      const first=document.querySelector('.page').getBoundingClientRect();
      return {host:{width:host.width,height:host.height},first:{width:first.width,height:first.height},overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(geometry.overflow,false);
    assert.ok(geometry.first.width<=geometry.host.width);
    if(viewport.width>600)assert.ok(geometry.first.height<=geometry.host.height);
    await page.screenshot({path:path.join(root,`reader-${viewport.width}.png`)});
    await page.getByRole('button',{name:'Próxima página',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[aria-label="Número da página"]').value==='2');
    await page.getByRole('textbox',{name:'Número da página'}).fill('130');
    await page.getByRole('textbox',{name:'Número da página'}).press('Enter');
    await page.waitForFunction(()=>document.querySelector('.ac-pdf-status').textContent.includes('Página 130'));
    assert.equal(await page.getByRole('button',{name:'Próxima página',exact:true}).isDisabled(),true);
    assert.ok(await page.locator('.page canvas').count()<25,'must not render all 130 pages');
    await page.getByRole('textbox',{name:'Número da página'}).fill('999');
    await page.getByRole('textbox',{name:'Número da página'}).press('Enter');
    assert.equal(await page.getByRole('textbox',{name:'Número da página'}).inputValue(),'130');
    await page.getByRole('button',{name:'Buscar no documento',exact:true}).click();
    await page.getByRole('textbox',{name:'Texto para buscar'}).fill('Conhecimento');
    await page.waitForFunction(()=>document.querySelector('.ac-pdf-search [role=status]').textContent.includes('de 129'));
    const previousMatch=await page.locator('.ac-pdf-search [role=status]').textContent();
    await page.getByRole('button',{name:'Próximo resultado',exact:true}).click();
    await page.waitForFunction(previous=>document.querySelector('.ac-pdf-search [role=status]').textContent!==previous,previousMatch);
    await page.getByRole('textbox',{name:'Texto para buscar'}).fill('zzzzinexistente');
    await page.waitForFunction(()=>document.querySelector('.ac-pdf-search [role=status]').textContent==='Nenhum resultado');
    await page.getByRole('button',{name:'Fechar busca'}).click();
    await page.getByRole('combobox',{name:'Ajuste de zoom'}).selectOption('1.5');
    await page.waitForFunction(()=>document.querySelector('.ac-pdf-status').textContent.includes('150%'));
    await page.getByRole('button',{name:'Girar página'}).click();
    await page.getByRole('combobox',{name:'Ajuste de zoom'}).selectOption('page-fit');
    await page.getByRole('button',{name:'Ampliar leitor'}).click();
    const full=await page.locator('.lb-reader').boundingBox();
    assert.ok(Math.abs(full.width-viewport.width)<2);
    await page.getByRole('button',{name:'Reduzir leitor'}).click();
    await page.getByRole('button',{name:'Fechar leitura'}).click();
    await page.getByRole('button',{name:'Abrir PDF',exact:true}).click();
    await page.waitForSelector('.page canvas');
    await page.waitForFunction(()=>!document.querySelector('.ac-pdf-state'));
    await page.getByRole('button',{name:'Fechar leitura'}).click();
    await page.getByRole('button',{name:'Trocar arquivo'}).click();
    await page.getByRole('button',{name:'Abrir PDF',exact:true}).click();
    await page.waitForSelector('[role=alert]');
    assert.match(await page.locator('[role=alert]').textContent(),/PDF válido/);
    await page.getByRole('button',{name:'Tentar novamente'}).click();
    await page.waitForSelector('[role=alert]');
    console.log(`PASS ${viewport.width}px: 130 pages, fit, navigation, search, zoom, rotation, expand, reopen, invalid PDF and retry`);
    await page.close();
  }
  if (process.env.PDF_READER_SAMPLE) {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>failures.push(error.message));
    await page.route('**/fixture.pdf',route=>route.fulfill({path:path.resolve(process.env.PDF_READER_SAMPLE),contentType:'application/pdf'}));
    await page.goto('http://127.0.0.1:5197');
    await page.waitForSelector('.page canvas');
    await page.waitForFunction(()=>!document.querySelector('.ac-pdf-state'));
    await page.screenshot({path:path.join(root,'reader-original.png')});
    for (const target of ['65','130']) {
      await page.getByRole('textbox',{name:'Número da página'}).fill(target);
      await page.getByRole('textbox',{name:'Número da página'}).press('Enter');
      await page.waitForFunction(n=>!!document.querySelector(`.page[data-page-number="${n}"] canvas`),target);
    }
    assert.equal(await page.locator('[role=alert]').count(),0);
    console.log('PASS original scanned PDF: cover, page 65 and page 130 rendered');
    await page.close();
  }
  assert.deepEqual(failures,[]);
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
