import type {Express,Request,Response} from 'express';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {createHash,randomUUID} from 'node:crypto';
import {requireAuthOrRespond} from './requireAuth.js';
import {assertUserCanAccessTenant,assertZeladorTenantAccess,normalizeFilhoRequestTenantId,resolveFilhoHouseRefs} from './tenantAccess.js';
import {comprovanteVisionRateLimit,sensitiveActionRateLimit} from './rateLimit.js';
import {safeErrorMessage} from './safeError.js';
import {extractComprovanteFieldsFromImage,validateComprovanteImage,valoresMensalidadeCoincidem} from './comprovanteVisionExtract.js';
import {comprovanteBeneficiarioMatches,cpfComprovanteMatches,normalizeComprovanteDate} from './comprovanteValidation.js';
import {validateReceiptDecision,type ReceiptAnalysis} from '../../lib/receiptReview.js';
import {resolveFilhoRowIdForFinance} from './resolveFilhoRowIdForFinance.js';

const BUCKET='mensalidade-comprovantes';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS=new Set(['em_analise','aceito','rejeitado','encerrado']);
type Deps={supabaseAdmin:SupabaseClient;resolveLeaderId:(id:string)=>Promise<string>;
  liquidarMensalidadePendente?:unknown;
  notifyMensalidadeConfirmadaWhatsApp:(sb:SupabaseClient,args:{tenantId:string;zeladorId:string;filhoId:string;nome:string;valor:number;competencia:string})=>Promise<void>;
  extract?:typeof extractComprovanteFieldsFromImage;
};
type Access={user:User;tenant:string;child:any|null};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const filhoId=(r:any)=>String(r.filho_id||String(r.descricao||'').match(/\(ID:([0-9a-f-]{36})\)/i)?.[1]||'').toLowerCase();
const pending=(r:any)=>['pendente','pending','atrasado','overdue'].includes(String(r.status||'').toLowerCase())||(!r.status&&String(r.descricao||'').includes('(vencimento'));
function fail(message:string,status=400):never {throw Object.assign(new Error(message),{statusCode:status});}
function resultRow(data:any){return Array.isArray(data)?data[0]:data;}
function errorResponse(res:Response,error:any){
  const code=String(error?.code||''),status=error?.statusCode||(code==='23505'?409:code==='42501'?403:['22023','22P02','22007','22008','23514'].includes(code)?422:500);
  if(status>=500)console.error('[receipt-review]',{code:code||'internal',message:safeErrorMessage(error)});
  return res.status(status).json({success:false,error:safeErrorMessage(error,'Não foi possível concluir. Tente novamente.')});
}
function dto(row:any){
  const a={...(row.analysis||{})};if(a.cpf_pagador){const digits=String(a.cpf_pagador).replace(/\D/g,'');if(digits.length===11)a.cpf_pagador='***.'+digits.slice(3,6)+'.'+digits.slice(6,9)+'-**';}
  return {id:row.id,financeiro_id:row.financeiro_id,filho_id:row.filho_id,status:row.status,
    created_at:row.created_at,decided_at:row.decided_at,decision_reason:row.decision_reason,
    analysis_status:row.analysis_status,analysis:a,alerts:row.alerts||[],submitted_value:Number(row.submitted_value),approved_fields:row.approved_fields,legacy:Boolean(row.legacy)};
}
async function deadline<T>(work:Promise<T>,ms=20_000):Promise<T>{let timer:ReturnType<typeof setTimeout>;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Leitura indisponível no momento')),ms);})]);}finally{clearTimeout(timer!);}}

export function buildReceiptAlerts(analysis:ReceiptAnalysis,cpf:string,beneficiario:string,dueValue:number):string[]{
  const alerts:string[]=[];
  if(!analysis.valor||!valoresMensalidadeCoincidem(dueValue,analysis.valor))alerts.push('Valor lido ausente ou diferente do total da mensalidade.');
  if(!cpfComprovanteMatches(cpf,analysis.cpf_pagador||''))alerts.push('CPF ausente, incompleto ou diferente do cadastro; confira quem realizou o pagamento.');
  if(!beneficiario||!comprovanteBeneficiarioMatches(beneficiario,analysis.beneficiario||''))alerts.push('Beneficiário não conferido com a configuração do terreiro.');
  if(analysis.estado_pagamento!=='concluido')alerts.push(analysis.estado_pagamento==='agendado'?'A imagem indica pagamento agendado; confira o crédito na conta.':analysis.estado_pagamento==='cancelado'?'A imagem indica cancelamento; confira o crédito na conta.':'A imagem não confirma que o pagamento foi concluído.');
  const date=normalizeComprovanteDate(analysis.data||'');if(!date||date>today())alerts.push('Data de pagamento ausente, inválida ou futura.');
  const id=String(analysis.id_transacao||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(id.length<10||id.length>128)alerts.push('Identificador bancário ausente ou ilegível.');
  return alerts;
}

export function registerReceiptReviewRoutes(app:Express,deps:Deps){
  const sb=deps.supabaseAdmin;
  async function access(req:Request,res:Response):Promise<Access|null>{
    const user=await requireAuthOrRespond(sb,req,res);if(!user)return null;
    const memberId=await resolveFilhoRowIdForFinance(sb,{jwtUserId:user.id,jwtEmail:user.email||undefined});
    let child:any=null;
    if(memberId){const {data,error}=await sb.from('filhos_de_santo').select('id,nome,cpf,user_id,tenant_id,lider_id,email').eq('id',memberId).maybeSingle();if(error)throw error;child=data;}
    else if(await resolveFilhoHouseRefs(sb,user))fail('Não foi possível resolver o cadastro do membro.',403);
    let input=String(req.query.tenantId||req.body?.tenant_id||req.body?.tenantId||child?.lider_id||child?.tenant_id||user.id).trim();
    input=await normalizeFilhoRequestTenantId(sb,user,input);
    if(!UUID.test(input)||!(await assertUserCanAccessTenant(sb,user,input)))fail('Acesso negado a este terreiro.',403);
    const tenant=await deps.resolveLeaderId(input);
    if(!child&&!(await assertZeladorTenantAccess(sb,user.id,tenant)))fail('Acesso negado.',403);
    return {user,tenant,child};
  }
  async function getReview(id:string,ctx:Access){
    if(!UUID.test(id))fail('Comprovante não encontrado.',404);
    const {data,error}=await sb.from('mensalidade_comprovante_envios').select('*').eq('id',id).eq('tenant_id',ctx.tenant).maybeSingle();
    if(error)throw error;if(!data||(ctx.child&&String(data.filho_id)!==String(ctx.child.id)))fail('Comprovante não encontrado.',404);return data;
  }
  async function enrich(rows:any[]){
    if(!rows.length)return [];
    const [children,finance]=await Promise.all([
      sb.from('filhos_de_santo').select('id,nome').in('id',[...new Set(rows.map(r=>r.filho_id))]),
      sb.from('financeiro').select('id,valor,data,data_vencimento,status').in('id',[...new Set(rows.map(r=>r.financeiro_id))]),
    ]);if(children.error)throw children.error;if(finance.error)throw finance.error;
    const names=new Map((children.data||[]).map(c=>[c.id,c.nome]));const debts=new Map((finance.data||[]).map(f=>[f.id,f]));
    return rows.map(row=>{const f=debts.get(row.financeiro_id);return {...dto(row),nome:names.get(row.filho_id)||'Membro',valor_atual:Number(f?.valor??row.submitted_value),competencia:String(f?.data_vencimento||f?.data||'').slice(0,10)};});
  }
  function sendSubmission(res:Response,row:any,v2:boolean){
    const message='Comprovante recebido. Aguarde a análise do zelador; a mensalidade ainda não foi quitada.';
    res.setHeader('Cache-Control','private, no-store');
    return res.status(202).json({success:v2,status:row.status,requires_review:true,data:dto(row),message,...(!v2?{error:message}:{}),replayed:Boolean(row.replayed)});
  }

  app.post('/api/v1/financeiro/validar-comprovante',comprovanteVisionRateLimit,async(req,res)=>{
    let uploadedPath:string|null=null;let registered=false;
    try{
      const ctx=await access(req,res);if(!ctx)return;if(!ctx.child?.id)fail('Somente o membro pode enviar o próprio comprovante.',403);
      const body=req.body||{},v2=body.workflow==='manual_review_v1';
      let financeiroId=String(body.financeiro_id||'').trim();let finance:any;
      if(!financeiroId){
        const refs=[ctx.tenant,ctx.child.tenant_id,ctx.child.lider_id].filter(Boolean);
        const {data,error}=await sb.from('financeiro').select('*').eq('categoria','Mensalidade').or([...new Set(refs)].flatMap(id=>[`tenant_id.eq.${id}`,`lider_id.eq.${id}`]).join(','));
        if(error)throw error;const eligible=(data||[]).filter(r=>filhoId(r)===String(ctx.child.id).toLowerCase()&&pending(r));
        if(eligible.length!==1)fail('Escolha a mensalidade e atualize a página antes de enviar o comprovante.',409);
        finance=eligible[0];financeiroId=finance.id;
      }else{
        if(!UUID.test(financeiroId))fail('Mensalidade inválida.');
        const {data,error}=await sb.from('financeiro').select('*').eq('id',financeiroId).maybeSingle();if(error)throw error;finance=data;
      }
      const refs=new Set([ctx.tenant,ctx.child.tenant_id,ctx.child.lider_id]);
      if(!finance||finance.categoria!=='Mensalidade'||filhoId(finance)!==String(ctx.child.id).toLowerCase()||(!refs.has(finance.tenant_id)&&!refs.has(finance.lider_id)))fail('Mensalidade não encontrada para este membro.',404);
      const raw=String(body.fileData??body.image??body.comprovante??'').trim(),encoded=raw.includes(',')?raw.slice(raw.indexOf(',')+1):raw;
      if(!encoded||encoded.length>7_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4!==0)fail('Arquivo inválido. Envie uma imagem JPEG, PNG ou WebP de até 5 MB.',422);
      const buffer=Buffer.from(encoded,'base64');if(buffer.toString('base64')!==encoded)fail('Imagem inválida.',422);
      let mime:string;try{mime=await validateComprovanteImage(buffer,String(body.contentType||body.mimeType||'image/jpeg'));}catch(error){fail(safeErrorMessage(error,'Imagem inválida.'),422);}
      const sha=createHash('sha256').update(buffer).digest('hex');
      const {data:open,error:openError}=await sb.from('mensalidade_comprovante_envios').select('*').eq('financeiro_id',financeiroId).eq('status','em_analise').maybeSingle();if(openError)throw openError;
      if(open){if(open.submitted_by===ctx.user.id&&open.arquivo_sha256===sha)return sendSubmission(res,{...open,replayed:true},v2);fail('Esta mensalidade já possui comprovante em análise.',409);}
      const requestId=String(body.request_id||randomUUID());if(!UUID.test(requestId))fail('Identificador de envio inválido.');
      // Replay is checked before testing debt status: a lost successful response can be retried safely.
      const {data:replay,error:replayError}=await sb.from('mensalidade_comprovante_envios').select('*').eq('submitted_by',ctx.user.id).eq('request_id',requestId).maybeSingle();if(replayError)throw replayError;
      if(replay){if(replay.financeiro_id!==financeiroId||replay.arquivo_sha256!==sha)fail('Identificador já utilizado para outro envio.',409);return sendSubmission(res,{...replay,replayed:true},v2);}
      const {data:used,error:usedError}=await sb.from('financeiro_comprovantes').select('id').eq('arquivo_sha256',sha).maybeSingle();if(usedError)throw usedError;if(used)fail('Este comprovante já foi utilizado para confirmar um pagamento.',409);
      if(!pending(finance))fail('Esta mensalidade não está pendente.',409);
      const extension=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
      uploadedPath=`${ctx.tenant}/${ctx.child.id}/${randomUUID()}.${extension}`;
      const upload=await sb.storage.from(BUCKET).upload(uploadedPath,buffer,{contentType:mime,upsert:false});if(upload.error)throw upload.error;
      const {data,error}=await sb.rpc('registrar_envio_comprovante',{p_actor:ctx.user.id,p_tenant:ctx.tenant,p_filho:ctx.child.id,p_financeiro:financeiroId,p_request:requestId,p_path:uploadedPath,p_sha:sha,p_mime:mime,p_size:buffer.length});
      if(error)throw error;let row=resultRow(data);if(!row?.id)throw Error('O banco não confirmou o recebimento do comprovante.');registered=true;
      if(row.storage_path!==uploadedPath){await sb.storage.from(BUCKET).remove([uploadedPath]);uploadedPath=null;}
      if(!row.replayed){
        let analysis:ReceiptAnalysis={},alerts:string[]=[],analysisStatus='concluida';
        try{
          analysis=await deadline((deps.extract||extractComprovanteFieldsFromImage)(buffer,mime));
          const pixRefs=[...new Set([ctx.tenant,ctx.child.tenant_id].filter(id=>UUID.test(String(id))))];
          const {data:pix,error:pixError}=await sb.from('configuracoes_pix').select('nome_beneficiario').or(pixRefs.map(id=>`terreiro_id.eq.${id}`).join(',')).limit(1).maybeSingle();
          alerts=buildReceiptAlerts(analysis,String(ctx.child.cpf||''),pixError?'':String(pix?.nome_beneficiario||''),Number(finance.valor));
        }catch{analysisStatus='indisponivel';alerts=['A IA não conseguiu ler este arquivo. Confira a imagem e preencha os dados do recebimento.'];}
        const update=await sb.from('mensalidade_comprovante_envios').update({analysis,alerts,analysis_status:analysisStatus}).eq('id',row.id).eq('status','em_analise').select('*').maybeSingle();
        if(update.error)console.error('[receipt-review] análise não persistida',{code:update.error.code});
        if(update.data)row=update.data;
      }
      return sendSubmission(res,row,v2);
    }catch(error){if(uploadedPath&&!registered){try{
      // A lost RPC response may already have committed. Never delete its persisted image.
      const saved=await sb.from('mensalidade_comprovante_envios').select('id').eq('storage_path',uploadedPath).maybeSingle();
      if(!saved.error&&!saved.data){const cleanup=await sb.storage.from(BUCKET).remove([uploadedPath]);if(cleanup.error)console.error('[receipt-review] limpeza do arquivo pendente');}
    }catch{console.error('[receipt-review] limpeza adiada para preservar possível envio confirmado');}}return errorResponse(res,error);}
  });

  app.get('/api/v1/financial/comprovantes',async(req,res)=>{
    try{
      const ctx=await access(req,res);if(!ctx)return;
      const status=String(req.query.status||'em_analise');if(status!=='todos'&&!STATUS.has(status))fail('Filtro inválido.');
      const limit=Math.max(1,Math.min(Math.floor(Number(req.query.limit)||30),100));
      let q=sb.from('mensalidade_comprovante_lista').select('*').eq('tenant_id',ctx.tenant).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit);
      if(ctx.child)q=q.eq('filho_id',ctx.child.id);if(status!=='todos')q=q.eq('status',status);
      if(req.query.cursor){let cursor:any;try{cursor=JSON.parse(Buffer.from(String(req.query.cursor),'base64url').toString());}catch{fail('Página inválida.');}
        if(!UUID.test(String(cursor.id))||!/^\d{4}-\d{2}-\d{2}T[0-9:.+Z-]+$/.test(String(cursor.date)))fail('Página inválida.');
        q=q.or(`created_at.lt.${cursor.date},and(created_at.eq.${cursor.date},id.lt.${cursor.id})`);
      }
      const {data,error}=await q;if(error)throw error;const rows=data||[],last=rows[rows.length-1];
      let openQuery=sb.from('mensalidade_comprovante_envios').select('financeiro_id',{count:'exact'}).eq('tenant_id',ctx.tenant).eq('status','em_analise');
      if(ctx.child)openQuery=openQuery.eq('filho_id',ctx.child.id);
      const open=await openQuery;if(open.error)throw open.error;
      res.setHeader('Cache-Control','private, no-store');return res.json({data:await enrich(rows),pending_count:open.count??open.data?.length??0,open_financeiro_ids:(open.data||[]).map(r=>r.financeiro_id),next_cursor:rows.length===limit?Buffer.from(JSON.stringify({date:last.created_at,id:last.id})).toString('base64url'):null});
    }catch(error){return errorResponse(res,error);}
  });

  app.get('/api/v1/financial/comprovantes/eventos',async(req,res)=>{
    try{
      const ctx=await access(req,res);if(!ctx)return;
      let q=sb.from('mensalidade_comprovante_eventos').select('*').eq('tenant_id',ctx.tenant).order('created_at',{ascending:false}).limit(50);
      q=ctx.child?q.eq('filho_id',ctx.child.id).neq('tipo','enviado'):q.eq('tipo','enviado');
      const {data,error}=await q;if(error)throw error;
      res.setHeader('Cache-Control','private, no-store');
      return res.json({data:(data||[]).map(row=>({id:`comprovante:${row.envio_id}:${row.tipo}`,type:'payment',created_at:row.created_at,
        title:row.tipo==='enviado'?'Comprovante aguardando análise':row.tipo==='aceito'?'Pagamento confirmado':row.tipo==='rejeitado'?'Comprovante precisa de atenção':'Mensalidade encerrada por outra via',
        body:row.tipo==='enviado'?'Confira o comprovante no Financeiro antes de confirmar a baixa.':'Consulte o resultado e o motivo na sua mensalidade.'}))});
    }catch(error){return errorResponse(res,error);}
  });

  app.get('/api/v1/financial/comprovantes/:id/arquivo',async(req,res)=>{
    try{const ctx=await access(req,res);if(!ctx)return;const row=await getReview(String(req.params.id),ctx);
      const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(row.storage_path,300);if(error||!data?.signedUrl)throw error||Error('Arquivo indisponível.');
      res.setHeader('Cache-Control','private, no-store');return res.json({url:data.signedUrl,expires_in:300});
    }catch(error){return errorResponse(res,error);}
  });
  for(const action of ['aprovar','rejeitar'] as const)app.post(`/api/v1/financial/comprovantes/:id/${action}`,sensitiveActionRateLimit,async(req,res)=>{
    try{
      const ctx=await access(req,res);if(!ctx)return;if(ctx.child)fail('O membro não pode confirmar a própria mensalidade.',403);
      const row=await getReview(String(req.params.id),ctx);let fields:Record<string,unknown>=req.body||{};
      if(action==='aprovar'&&row.status!=='aceito'){
        const {data:finance,error}=await sb.from('financeiro').select('valor').eq('id',row.financeiro_id).maybeSingle();if(error)throw error;if(!finance)fail('Mensalidade não encontrada.',404);
        try{fields=validateReceiptDecision(fields,finance.valor,(row.alerts||[]).length>0||row.analysis_status!=='concluida',today());}catch(error){fail(safeErrorMessage(error),422);}
      }
      const {data,error}=await sb.rpc('decidir_envio_comprovante',{p_actor:ctx.user.id,p_envio:row.id,p_decisao:action==='aprovar'?'aceito':'rejeitado',p_fields:fields});if(error)throw error;
      const decision=resultRow(data);if(!decision?.id)throw Error('O banco não confirmou a decisão.');
      if(action==='aprovar'&&!decision.replayed){
        const {data:child}=await sb.from('filhos_de_santo').select('nome').eq('id',row.filho_id).maybeSingle();
        void deps.notifyMensalidadeConfirmadaWhatsApp(sb,{tenantId:ctx.tenant,zeladorId:ctx.tenant,filhoId:row.filho_id,nome:String(child?.nome||'Filho'),valor:Number(decision.valor),competencia:String(decision.competencia||'')}).catch(()=>console.error('[receipt-review] confirmação WhatsApp não enviada'));
      }
      return res.json({success:true,data:decision});
    }catch(error){return errorResponse(res,error);}
  });
}
