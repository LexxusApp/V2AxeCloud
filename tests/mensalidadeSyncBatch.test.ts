import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import ts from 'typescript';import {format} from 'date-fns';
import {childEligibleForDueMonth, clampDayInMonth} from '../api/lib/mensalidadeEligibility.ts';
import {readMensalidadesForChildren,insertMensalidadesBatch,singleFlightMensalidadeSync} from '../api/lib/mensalidadeSyncBatch.ts';
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
function database(children:any[], records:any[]=[], failRead=false) {
  const calls:any[]=[];const writes:any[]=[];
  const sb:any={from(table:string){let columns='*',filter='',from=0,to=999,operation='read',values:any,where:any={};
    const q:any={select:(cols:string)=>{columns=cols;return q;},eq:(key:string,value:any)=>{where[key]=value;return q;},in:(key:string,values:any[])=>{where[key]=values;return q;},or:(v:string)=>{filter=v;return q;},order:()=>q,range:(a:number,b:number)=>{from=a;to=b;return q;},limit:()=>q,
      maybeSingle:async()=>({data:{valor_mensalidade:100,dia_vencimento:10},error:null}),
      insert:(rows:any)=>{operation='insert';values=rows;return q;},update:(row:any)=>{operation='update';values=row;return q;},delete:()=>{operation='delete';return q;},
      then(resolve:any){calls.push({table,columns,filter,operation,from,to});if(operation!=='read'){writes.push({operation,values,where,filter});return Promise.resolve({error:null}).then(resolve);}
        if(failRead&&table==='financeiro'&&columns==='*')return Promise.resolve({data:null,error:Error('database unavailable')}).then(resolve);
        let data=table==='filhos_de_santo'?children:table==='financeiro'?records:[];
        if(filter&&table==='financeiro')data=data.filter((r:any)=>filter.includes(String(r.filho_id))||filter.includes(String(r.descricao).match(/ID:([0-9a-f-]{36})/)?.[1]||'not-found'));
        return Promise.resolve({data:data.slice(from,to+1),error:null}).then(resolve);}};return q;}};
  return {sb,calls,writes};
}
// Exercise the actual API function without starting the HTTP server or production jobs.
function syncFunction(active=true) {
  const source=readFileSync(new URL('../api/index.ts',import.meta.url),'utf8');
  const helpers=source.slice(source.indexOf('type MensalidadeZeladorRow ='),source.indexOf('async function fetchMensalidadesPendentesList('));
  const sync=source.slice(source.indexOf('async function syncMensalidadesPendentes('),source.indexOf('async function loadFinanceiroRow('));
  const compiled=ts.transpile(`const {format,clampDayInMonth,childEligibleForDueMonth,readMensalidadesForChildren,insertMensalidadesBatch,isMensalidadeAtivaForTenant}=deps;\n${helpers}\n${sync}\nreturn syncMensalidadesPendentes;`,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
  return new Function('deps',compiled)({format,clampDayInMonth,childEligibleForDueMonth,readMensalidadesForChildren,insertMensalidadesBatch,isMensalidadeAtivaForTenant:async()=>active});
}
const child=(n:number)=>({id:id(n),nome:'Membro',tenant_id:id(900),lider_id:id(900),status:'Ativo',created_at:'2020-01-01',data_entrada:'2020-01-01'});
const month=()=>format(new Date(),'yyyy-MM');

test('100 membros: quatro consultas em lote e uma inserção, sem consultas financeiras por membro',async()=>{
  const db=database(Array.from({length:100},(_,n)=>child(n+1)));
  const result=await syncFunction()(db.sb,async()=>id(900),id(900),id(900));
  assert.equal(result.created,100);assert.equal(db.calls.filter(c=>c.operation==='read'&&c.table==='financeiro'&&c.columns==='*').length,4);
  assert.equal(db.writes.length,1);assert.equal(db.writes[0].values.length,100);
  assert.ok(db.writes[0].values.every((r:any)=>r.status==='pendente'&&r.filho_id&&r.valor===100));
});
test('mensalidade manual com juros, quitadas e débitos antigos são preservados',async()=>{
  const records=[
    {id:id(500),filho_id:id(1),categoria:'Mensalidade',tipo:'entrada',status:'pendente',data:`${month()}-10`,data_vencimento:`${month()}-10`,valor:102,lancamento_manual:true,tenant_id:id(900)},
    {id:id(501),filho_id:id(2),categoria:'Mensalidade',tipo:'entrada',status:'pago',data:`${month()}-10`,valor:100,tenant_id:id(900)},
    {id:id(502),filho_id:id(3),categoria:'Mensalidade',tipo:'entrada',status:'pendente',data:'2020-01-10',valor:77,tenant_id:id(900)},
  ];const db=database([child(1),child(2),child(3)],records);
  const result=await syncFunction()(db.sb,async()=>id(900),id(900),id(900));
  assert.equal(result.created,1);assert.equal(result.removed,0);assert.equal(result.revalued,0);
  assert.equal(db.writes.length,1);assert.equal(db.writes[0].values[0].filho_id,id(3));assert.equal(records[0].valor,102);assert.equal(records[2].valor,77);
});
test('legado sem filho_id continua reconhecido pelo ID da descrição',async()=>{
  const db=database([child(1)],[{id:id(500),filho_id:null,descricao:`Mensalidade (vencimento ${month()}-10) (ID:${id(1)})`,categoria:'Mensalidade',status:null,data:`${month()}-10`,valor:100,tenant_id:id(900)}]);
  assert.equal((await syncFunction()(db.sb,async()=>id(900),id(900),id(900))).created,0);assert.equal(db.writes.length,0);
});
test('reavaliação automática exige que o débito continue pendente e não tenha virado lançamento manual',async()=>{
  const db=database([child(1)],[{id:id(500),filho_id:id(1),categoria:'Mensalidade',tipo:'entrada',status:'pendente',data:`${month()}-10`,valor:80,lancamento_manual:false,tenant_id:id(900)}]);
  const result=await syncFunction()(db.sb,async()=>id(900),id(900),id(900));
  assert.equal(result.revalued,1);assert.equal(db.writes[0].operation,'update');
  assert.deepEqual(db.writes[0].where.status,['pendente','atrasado','pending','overdue']);
  assert.equal(db.writes[0].filter,'lancamento_manual.is.null,lancamento_manual.eq.false');
});
test('falha de leitura impede criar cobranças a partir de um retrato incompleto',async()=>{
  const db=database([child(1)],[],true);await assert.rejects(syncFunction()(db.sb,async()=>id(900),id(900),id(900)));assert.equal(db.writes.length,0);
});
test('cobrança desativada e filhos não elegíveis não geram débitos',async()=>{
  const db=database([child(1)]);assert.equal((await syncFunction(false)(db.sb,async()=>id(900),id(900),id(900))).mensalidade_ativa,false);assert.equal(db.calls.length,0);
  const inactive=database([{...child(1),status:'Inativo'},{...child(2),created_at:'2099-01-01'}]);
  assert.equal((await syncFunction()(inactive.sb,async()=>id(900),id(900),id(900))).created,0);assert.equal(inactive.writes.length,0);
});
test('paginação lê além de 1000 registros sem truncar a verificação',async()=>{
  const records=Array.from({length:1001},(_,n)=>({id:id(n+100),filho_id:id(1)}));const db=database([],records);
  assert.equal((await readMensalidadesForChildren(db.sb,[id(1)],true)).length,1001);assert.equal(db.calls.length,2);
});
test('erro de inserção real não é escondido; fallback só retira colunas ausentes',async()=>{
  let count=0;const payload:any[]=[];const sb:any={from:()=>({insert:async(rows:any[])=>{payload.push(rows.map(r=>({...r})));return count++===0?{error:{code:'PGRST204',message:'Could not find data_vencimento in schema cache'}}:{error:null};}})};
  assert.equal(await insertMensalidadesBatch(sb,[{filho_id:id(1),data_vencimento:'2026-10-10',status:'pendente'}]),1);
  assert.equal(payload[1][0].data_vencimento,undefined);assert.equal(payload[1][0].filho_id,id(1));
  await assert.rejects(insertMensalidadesBatch({from:()=>({insert:async()=>({error:Error('offline')})})},[{filho_id:id(1)}]));
});
test('requisições simultâneas compartilham a mesma escrita, falhas permitem retry e outro terreiro é isolado',async()=>{
  let done!:()=>void,calls=0;const task=async()=>{calls++;await new Promise<void>(r=>{done=r;});return {created:1};};
  const a=singleFlightMensalidadeSync('tenant-a',task),b=singleFlightMensalidadeSync('tenant-a',task);assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);done();await a;
  await assert.rejects(singleFlightMensalidadeSync('tenant-a',async()=>{throw Error('offline');}));
  assert.equal(await singleFlightMensalidadeSync('tenant-b',async()=>2),2);
  assert.equal(await singleFlightMensalidadeSync('tenant-a',async()=>3),3);
});
