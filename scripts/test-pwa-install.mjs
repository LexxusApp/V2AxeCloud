import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

// Executa os bundles reais, com sessão e APIs fictícias, sem alterar produção.
const output = path.resolve('artifacts/pwa-install-check');
await mkdir(output, {recursive: true});
const dist = path.resolve('artifacts/pilot-release-20261101/dist');
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let file;
  if (url.pathname === '/dashboard') file = path.join(dist, url.searchParams.get('space') === 'member' ? 'member/index.html' : 'index.html');
  else if (url.pathname.startsWith('/assets/member-pilot-20261102/')) file = path.join(dist, 'member', url.pathname.slice('/assets/member-pilot-20261102/'.length));
  else if (url.pathname.startsWith('/assets/pilot-20261101/')) file = path.join(dist, url.pathname.slice('/assets/pilot-20261101/'.length));
  else file = path.join(path.resolve('public'), url.pathname);
  try {
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp'};
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: true});
const user = {id:'11111111-1111-4111-8111-111111111111', email:'pwa@example.test', app_metadata:{}, user_metadata:{}};
const tenant = {tenant_id:'22222222-2222-4222-8222-222222222222', role:'admin', status:'active', nome:'Casa de teste', nome_terreiro:'Casa de teste'};
const member = {id:'33333333-3333-4333-8333-333333333333', user_id:user.id, tenant_id:tenant.tenant_id, status:'Ativo', nome:'Membro de teste'};

async function open(space, mobile = false, ios = false, standalone = false) {
  const context = await browser.newContext({viewport:mobile ? {width:390,height:844} : {width:1440,height:1000}, ...(ios ? {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'} : {})});
  await context.addInitScript(({user, standalone}) => {
    localStorage.setItem('axecloud-auth-token', JSON.stringify({access_token:'fixture-token',refresh_token:'fixture-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user}));
    if (standalone) Object.defineProperty(navigator, 'standalone', {value:true});
  }, {user, standalone});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'pwa-fixture.supabase.co') {
      const isProfile = url.pathname.includes('perfil_lider');
      return route.fulfill({json:isProfile ? {id:user.id,zelador:'Gestor de teste',nome_terreiro:'Casa de teste'} : []});
    }
    if (url.pathname.startsWith('/api/')) {
      let data = {data:[]};
      if (url.pathname === '/api/public-config') data = {supabaseUrl:'https://pwa-fixture.supabase.co',supabaseAnonKey:'fixture-public-anon'};
      if (url.pathname === '/api/tenant-info') data = tenant;
      if (url.pathname === '/api/pilot/interface-access') data = {enabled:true,interface:space,profile:{...tenant,role:space==='member'?'filho':'admin'},member};
      if (url.pathname.includes('/whatsapp/')) data = {status:'DISCONNECTED',preferences:{}};
      if (url.pathname.includes('/settings/portal-consulente')) data = {};
      return route.fulfill({json:data});
    }
    if (url.origin !== origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/dashboard?space=${space}`, {waitUntil:'networkidle'});
  if (space === 'manager') {
    await page.locator('.topbar-avatar').click();
  } else if (mobile) await page.getByRole('button', {name:'Abrir menu',exact:true}).click();
  return {context,page,errors};
}

try {
  for (const space of ['manager','member']) {
    for (const mobile of [false,true]) {
      const {context,page,errors} = await open(space,mobile);
      const button = page.getByRole('button',{name:'Instalar app',exact:true}).filter({visible:true});
      const pressInstall = async () => {
        if (!await button.isVisible()) {
          if (space === 'manager') await page.locator('.topbar-avatar').click();
          else if (mobile) await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
        }
        await button.click();
      };
      await pressInstall();
      const dialog = page.getByRole('dialog',{name:'Instalar o AxéCloud'});
      await dialog.waitFor();
      assert.ok(await dialog.getByText('Instalar aplicativo',{exact:true}).isVisible());
      const box = await dialog.boundingBox();
      assert.ok(box.x>=0 && box.x+box.width<=page.viewportSize().width+1);
      await page.screenshot({path:path.join(output,`${space}-${mobile?'mobile':'desktop'}.png`)});
      await dialog.getByRole('button',{name:'Entendi',exact:true}).click();
      await dialog.waitFor({state:'hidden'});
      await pressInstall();
      await dialog.waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden'});
      await page.evaluate(() => {
        window.installCalls = 0;
        const offer = outcome => {
          const event = new Event('beforeinstallprompt',{cancelable:true});
          event.prompt = async () => {window.installCalls++;};
          event.userChoice = Promise.resolve({outcome,platform:'web'});
          window.dispatchEvent(event);
        };
        window.offerInstall = offer;
        offer('dismissed');
      });
      await pressInstall();
      assert.equal(await page.evaluate(()=>window.installCalls),1);
      assert.equal(await dialog.count(),0);
      await pressInstall(); // Depois de cancelar: abre ajuda, não repete evento usado.
      await dialog.waitFor();
      assert.equal(await page.evaluate(()=>window.installCalls),1);
      await page.keyboard.press('Escape');
      await page.evaluate(()=>window.offerInstall('accepted'));
      await pressInstall();
      assert.equal(await page.evaluate(()=>window.installCalls),2);
      await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
      await button.waitFor({state:'hidden'});
      assert.deepEqual(errors,[]);
      console.log(`PASS ${space} ${mobile?'mobile':'desktop'}: ajuda, cancelar, nova instalação, instalado, teclado e largura`);
      await context.close();
    }
  }
  const ios = await open('member',true,true);
  await ios.page.getByRole('button',{name:'Instalar app',exact:true}).filter({visible:true}).click();
  await ios.page.getByRole('dialog',{name:'Instalar o AxéCloud'}).getByText('Adicionar à Tela de Início',{exact:true}).waitFor();
  assert.deepEqual(ios.errors,[]);
  console.log('PASS iPhone: orientações para Safari e tela inicial');
  await ios.context.close();
  const installed = await open('manager',false,false,true);
  assert.equal(await installed.page.getByRole('button',{name:'Instalar app',exact:true}).count(),0);
  console.log('PASS standalone: opção de instalar oculta');
  await installed.context.close();
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
