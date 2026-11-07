import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';

// Optional isolated PostgreSQL runtime. Install outside the repository with:
// npm install --prefix <temp>/axecloud-pilot-notices-validation --no-save --ignore-scripts @electric-sql/pglite
let PGlite:any;
try { ({PGlite}=createRequire(path.join(tmpdir(),'axecloud-pilot-notices-validation','package.json'))('@electric-sql/pglite')); } catch {}
const migration=readFileSync('supabase/migrations/20261103120000_pilot_notices.sql','utf8');
const validation=readFileSync('tests/pilotNotices.validation.sql','utf8');
test('isolated PostgreSQL executes the migration, RLS, RPCs, idempotency and rollback fixtures',{skip:!PGlite},async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
   grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table auth.users(id uuid primary key,email text);
   create table public.perfil_lider(id uuid primary key,tenant_id uuid,status text,role text);
   create table public.subscriptions(id uuid primary key,status text,role text);
   create table public.filhos_de_santo(id uuid primary key,tenant_id uuid,lider_id uuid,user_id uuid,nome text,email text,status text,whatsapp_phone text);
   create table public.calendario_axe(id uuid primary key,tenant_id uuid);
   create table public.mural_avisos(id uuid primary key,tenant_id uuid,titulo text,conteudo text,categoria text,expiracao date,data_publicacao timestamptz);
   insert into auth.users values('fad75b91-d2eb-4805-b5a3-c19e8a073bed','vendasmercadolivrev1@gmail.com'),('ab2eef13-604c-4c8f-9d14-f3da41cc5a81','f_3666b777-1066-4eb7-a0c3-f63c2e01ae90@axecloud.internal');
   insert into public.perfil_lider values('fad75b91-d2eb-4805-b5a3-c19e8a073bed','fad75b91-d2eb-4805-b5a3-c19e8a073bed','active','zelador');
   insert into public.subscriptions values('fad75b91-d2eb-4805-b5a3-c19e8a073bed','active','zelador');
   insert into public.filhos_de_santo values('3666b777-1066-4eb7-a0c3-f63c2e01ae90','fad75b91-d2eb-4805-b5a3-c19e8a073bed','fad75b91-d2eb-4805-b5a3-c19e8a073bed','ab2eef13-604c-4c8f-9d14-f3da41cc5a81','Mock member','lucasteste@gmail.com','Ativo','11900000000');
   insert into public.mural_avisos values('ee555555-5555-4555-8555-555555555555','fad75b91-d2eb-4805-b5a3-c19e8a073bed','Legacy public notice','Public historical technical fixture','Geral',null,now());
  `);
  await db.exec(migration);
  const result=await db.exec(validation);assert.equal(result.at(-1)?.rows?.[0]?.pilot_notices_validation,'passed');
  const counts=await db.query('select (select count(*)::int from public.piloto_comunicados) notices,(select count(*)::int from public.piloto_comunicados_envios) deliveries,(select count(*)::int from public.mural_avisos) legacy');
  assert.deepEqual(counts.rows,[{notices:1,deliveries:0,legacy:1}]);
  // Revocation checks touch only this synthetic database, never real accounts.
  for(const change of [
   "update auth.users set email='revoked@example.invalid' where id='fad75b91-d2eb-4805-b5a3-c19e8a073bed'",
   "update public.perfil_lider set status='blocked'",
   "update public.perfil_lider set role='filho'",
   "update public.perfil_lider set tenant_id=gen_random_uuid()",
   "update public.subscriptions set status='deleted'"
  ]){
   await db.exec('begin;'+change+";select set_config('request.jwt.claims','{\"sub\":\"fad75b91-d2eb-4805-b5a3-c19e8a073bed\",\"role\":\"authenticated\"}',true);set local role authenticated;");
   await assert.rejects(db.query("select public.piloto_comunicados_listar('fad75b91-d2eb-4805-b5a3-c19e8a073bed')"),/Conta não autorizada/);
   await db.exec('rollback');
  }
 } finally { await db.close(); }
});
