import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Executa os carregadores das próprias telas, com rede e setters controlados.
// Não exige sessão de produção nem faz gravações no banco.
function screenFunction(file: string, name: string, scope: Record<string, unknown>) {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `Função ${name} encontrada em ${file}`);
  const { outputText } = ts.transpileModule(`const run = ${expression.getText(source)}; return run;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
  return new Function(...Object.keys(scope), outputText)(...Object.values(scope));
}

const screens = [
  { file: 'src/views/Inventory.tsx', fn: 'fetchInventory', field: 'data', setter: 'setProducts' },
  { file: 'src/views/Store.tsx', fn: 'fetchProducts', field: 'data', setter: 'setProducts' },
  { file: 'src/views/Gallery.tsx', fn: 'fetchGallery', field: 'albums', setter: 'setAlbums' },
  { file: 'src/views/Library.tsx', fn: 'fetchMaterials', field: 'data', setter: 'setMaterials' },
];

for (const screen of screens) {
  for (const scenario of ['empty', 'real', 'http-error', 'offline', 'invalid-json', 'invalid-shape'] as const) {
    test(`${screen.fn}: ${scenario} nunca gera cadastros de demonstração`, async () => {
      let rows: unknown = null;
      let loading = true;
      let error: unknown = null;
      const realRow = { id: 'real-db-record', tenant_id: 'tenant-real', item: 'Cadastro da casa', quantidade_atual: 7, quantidade_minima: 2, nome: 'Produto real', media: [{ id: 'foto-real' }] };
      const payload = { [screen.field]: scenario === 'real' ? [realRow] : [] };
      const run = screenFunction(screen.file, screen.fn, {
        tenantId: 'tenant-real', effectiveTenantId: 'tenant-real',
        setLoading: (value: boolean) => { loading = value; },
        setLoadError: (value: unknown) => { error = value; },
        [screen.setter]: (value: unknown) => { rows = value; },
        resolveStoreTenantPk: async () => 'tenant-real', storeTenantParams: () => ({}),
        rowToProduct: (value: unknown) => value,
        readStaleCache: () => null, writeStaleCache: () => {}, clearStaleCacheKey: () => {},
        console: { warn() {}, error() {} },
        authFetch: async () => {
          if (scenario === 'offline') throw new Error('offline');
          if (scenario === 'invalid-json') return new Response('<html>unavailable</html>');
          if (scenario === 'invalid-shape') return Response.json({});
          return Response.json(payload, { status: scenario === 'http-error' ? 500 : 200 });
        },
      });
      await run();
      assert.equal(loading, false);
      assert.deepEqual(rows, scenario === 'real' ? [realRow] : []);
      assert.equal(Boolean(error), !['real', 'empty'].includes(scenario));
    });
  }
}

test('Biblioteca ignora o cache antigo que podia conter PDFs fictícios', async () => {
  const cleared: string[] = [];
  const read: string[] = [];
  let materials: unknown;
  const run = screenFunction('src/views/Library.tsx', 'fetchMaterials', {
    effectiveTenantId: 'tenant-real', setLoadError() {}, setLoading() {},
    setMaterials: (rows: unknown) => { materials = rows; },
    clearStaleCacheKey: (key: string) => { cleared.push(key); },
    readStaleCache: (key: string) => { read.push(key); return null; },
    writeStaleCache() {}, authFetch: async () => Response.json({ data: [] }),
  });
  await run();
  assert.deepEqual(cleared, ['library_mats_tenant-real']);
  assert.ok(read.every(key => key !== 'library_mats_tenant-real'));
  assert.deepEqual(materials, []);
});

const cantinaFile = 'src/components/financial/CantinaView.tsx';
test('Cantina limpa itens legados intactos e preserva produtos cadastrados ou editados', () => {
  const text = readFileSync(new URL(`../${cantinaFile}`, import.meta.url), 'utf8');
  const source = ts.createSourceFile(cantinaFile, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let legacy: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'LEGACY_MENU_ITEMS') legacy = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(legacy);
  const defaults = new Function(`return ${legacy.getText(source)}`)();
  const custom = { ...defaults[0], id: 'item-criado-pela-casa', nome: 'Café da casa' };
  const edited = { ...defaults[1], preco: 9.75 };
  const readMenu = screenFunction(cantinaFile, 'readMenuItems', {
    tenantId: 'tenant-real', storageKey: 'menu-real', LEGACY_MENU_ITEMS: defaults,
    localStorage: { getItem: () => JSON.stringify([...defaults, custom, edited]) },
  });
  assert.deepEqual(readMenu(), [custom, edited]);
});

for (const success of [true, false]) {
  test(`Cantina usa saldos da API e sinaliza falhas: sucesso=${success}`, async () => {
    let filhos: unknown, stats: unknown, transactions: unknown, error: unknown;
    const payload = { filhos: [{ id: 'membro-real', saldo_pendente: 17 }], stats: { total_pendente: 17, total_recebido_mes: 23, total_vendas_mes: 40, filhos_com_pendencia: 1, total_filhos: 1 }, transactions: [{ id: 'lancamento-real', valor: 17 }] };
    const run = screenFunction(cantinaFile, 'fetchCantinaData', {
      tenantId: 'tenant-real', setLoading() {}, console: { error() {} },
      setLoadError: (value: unknown) => { error = value; },
      setFilhos: (value: unknown) => { filhos = value; }, setStats: (value: unknown) => { stats = value; }, setTransactions: (value: unknown) => { transactions = value; },
      authFetch: async () => Response.json(success ? payload : { error: 'indisponível' }, { status: success ? 200 : 500 }),
    });
    await run();
    assert.deepEqual(filhos, success ? payload.filhos : []);
    assert.deepEqual(transactions, success ? payload.transactions : []);
    assert.equal(Boolean(error), !success);
    if (success) assert.deepEqual(stats, payload.stats);
  });
}

for (const fn of ['handleFinalizarComanda', 'handleLiquidarFilho', 'handleSalvarLimite']) {
  for (const offline of [true, false]) {
    test(`Cantina ${fn}: falha ${offline ? 'de rede' : 'HTTP'} não simula sucesso`, async () => {
      const notifications: string[] = [];
      let changed = false;
      const filho = { id: 'membro-real', nome: 'Membro real', saldo_pendente: 10 };
      const run = screenFunction(cantinaFile, fn, {
        cartItems: [{ nome: 'Produto da casa', quantidade: 1, preco: 5 }],
        selectedFilhoId: 'avulso', selectedFilho: null, totalNovoConsumo: 5,
        editingFilho: filho, novoLimite: 100, bloquearFiado: false, tenantId: 'tenant-real',
        setIsSubmittingConsumo() {}, setIsSavingLimite() {},
        comandaAttempt: { current: null },
        setCartItems() { changed = true; }, setSelectedFilhoId() { changed = true; },
        setEditingFilho() { changed = true; }, setFilhos() { changed = true; },
        fetchCantinaData() { changed = true; },
        confirmAction: async () => true, formatBRL: (value: number) => String(value),
        showHouseToast: (_message: string, tone: string) => { notifications.push(tone); },
        authFetch: async () => { if (offline) throw new Error('offline'); return Response.json({ error: 'Recusado pelo servidor' }, { status: 400 }); },
      });
      await run(fn === 'handleFinalizarComanda' ? 'pago' : fn === 'handleLiquidarFilho' ? filho : { preventDefault() {} });
      assert.deepEqual(notifications, ['error']);
      assert.equal(changed, false, 'Falha preserva a comanda, os saldos e o formulário');
    });
  }
}

test('Cantina só limpa uma comanda confirmada e reutiliza a identificação após falha de rede', async () => {
  const attempt = { current: null as any };
  const bodies: any[] = [];
  const notifications: string[] = [];
  let cleared = 0;
  let reloaded = 0;
  const run = screenFunction(cantinaFile, 'handleFinalizarComanda', {
    window: { dispatchEvent() {} },
    tenantId: 'tenant-real', selectedFilhoId: 'avulso', selectedFilho: null,
    cartItems: [{ nome: 'Produto da casa', quantidade: 2, preco: 5 }], totalNovoConsumo: 10,
    comandaAttempt: attempt, setIsSubmittingConsumo() {},
    setCartItems() { cleared++; }, setSelectedFilhoId() {},
    fetchCantinaData() { reloaded++; }, formatBRL: (value: number) => String(value),
    showHouseToast: (_message: string, tone: string) => notifications.push(tone),
    authFetch: async (_url: string, options: any) => {
      bodies.push(JSON.parse(options.body));
      if (bodies.length === 1) throw new Error('Conexão interrompida');
      if (bodies.length === 2) return Response.json({ success: true });
      return Response.json({ success: true, transaction: { id: 'registro-confirmado' } });
    },
  });
  await run('pago');
  await run('pago');
  assert.equal(cleared, 0, 'Nem rede interrompida nem resposta sem lançamento limpam a comanda');
  await run('pago');
  assert.equal(cleared, 1);
  assert.equal(reloaded, 1);
  assert.deepEqual(notifications, ['error', 'error', 'success']);
  assert.equal(new Set(bodies.map(body => body.comandaId)).size, 1);
  assert.deepEqual(bodies[0].itens, [{ nome: 'Produto da casa', quantidade: 2, preco: 5 }]);
});

for(const offline of [false,true]) test(`Cardápio não fecha formulário nem altera catálogo quando a gravação falha: offline=${offline}`,async()=>{
 let changed=false;const notifications:string[]=[];
 const run=screenFunction(cantinaFile,'handleSaveMenuItem',{
  tenantId:'tenant-real',itemForm:{nome:'Café',preco:'4,50',icon:'☕',cat:'bebidas',badge:''},editingItem:null,savingMenu:false,
  setSavingMenu(){},setMenuItems(){changed=true;},setIsItemModalOpen(){changed=true;},
  authFetch:async()=>{if(offline)throw new Error('Sem conexão');return Response.json({error:'Falha ao salvar'},{status:500});},
  showHouseToast:(_message:string,tone:string)=>notifications.push(tone),
 });
 await run({preventDefault(){}});assert.equal(changed,false);assert.deepEqual(notifications,['error']);
});
