-- REVISÃO SOMENTE. Não executado. Requer migration 20261103140000 e tenant piloto existente.
-- Uma única transação: as alterações de ensaio abaixo sempre devem terminar em ROLLBACK.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
create temporary table radar_test_profile(p jsonb) on commit drop;
insert into radar_test_profile values('{
 "publicName":"Casa de ensaio Radar","tradition":"Umbanda","description":"Apresentação técnica para validação com rollback.",
 "instructions":"Confirme a visita diretamente com a casa.","address":"Rua privada de ensaio","number":"123","noNumber":false,
 "complement":"Sala 2","neighborhood":"Bairro privado","cep":"01001-000","city":"São Paulo","uf":"SP",
 "phone":"11900000000","servicePhone":"11911111111","mapsUrl":"https://maps.google.com/?q=-23.5,-46.6",
 "latitude":"-23.5","longitude":"-46.6","showAddress":true,"published":true,"coverPosition":"top",
 "socials":[{"id":"ig","network":"instagram","url":"https://instagram.com/ensaio"},{"id":"fb","network":"facebook","url":"https://facebook.com/ensaio"},{"id":"tt","network":"tiktok","url":"https://tiktok.com/@ensaio"},{"id":"yt","network":"youtube","url":"https://youtube.com/@ensaio"},{"id":"site","network":"website","url":"https://example.invalid"}],
 "schedules":[{"id":"sexta","day":5,"start":"22:00","end":"02:00","title":"Encontro de ensaio","enabled":true},{"id":"pausado","day":1,"start":"19:00","end":"21:00","title":"Encontro pausado","enabled":false}],
 "cover":{"id":"capa","source":"https://example.invalid/capa.jpg","caption":"Legenda da capa","illustrative":false},
 "portrait":null,"gallery":[{"id":"foto","source":"https://example.invalid/foto.jpg","caption":"Legenda da foto","illustrative":false}]
}'::jsonb);
grant select on radar_test_profile to authenticated;
-- This fixture modifies only the explicitly allowed tenant, then rolls everything back.
delete from public.piloto_radar_perfis where tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
select set_config('request.jwt.claim.sub','fad75b91-d2eb-4805-b5a3-c19e8a073bed',true);
select set_config('request.jwt.claims','{"sub":"fad75b91-d2eb-4805-b5a3-c19e8a073bed","role":"authenticated"}',true);
do $$declare p jsonb;r jsonb;begin
 select t.p into p from radar_test_profile t;
 r:=public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',p,0);
 if (r->>'revision')::bigint<>1 or r->'profile' is distinct from p then raise exception 'FAIL round trip';end if;
 r:=public.piloto_radar_ler('fad75b91-d2eb-4805-b5a3-c19e8a073bed');
 if r->'profile'->'schedules'->0->>'end'<>'02:00' or jsonb_array_length(r->'profile'->'socials')<>5 then raise exception 'FAIL extras';end if;
 begin
  perform public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',jsonb_set(p,'{coverPosition}','"bottom"'),0);
  raise exception 'FAIL lost update accepted';exception when unique_violation then null;
 end;
 r:=public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',p,0);
 if (r->>'revision')::bigint<>1 then raise exception 'FAIL retry not idempotent';end if;
 begin
  perform public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',jsonb_set(p,'{socials,0,url}','"https://instagram.com.evil.invalid"'),1);
  raise exception 'FAIL unsafe URL accepted';exception when invalid_parameter_value then null;
 end;
 begin
  perform public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',jsonb_set(p,'{cover,coordinates}','"private"'),1);
  raise exception 'FAIL nested unknown field accepted';exception when invalid_parameter_value then null;
 end;
 perform public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',jsonb_set(p,'{showAddress}','false'),1);
 if exists(select 1 from public.terreiros_diretorio where claimed_by_tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed' and (endereco is not null or bairro is not null or bairro_slug is not null or cep is not null or latitude is not null or longitude is not null or link_maps is not null)) then raise exception 'FAIL legacy privacy';end if;
 update public.terreiros_diretorio set endereco='bypass',latitude=1,longitude=2,cep='12345678',link_maps='https://maps.google.com/?q=1,2' where claimed_by_tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 if exists(select 1 from public.terreiros_diretorio where claimed_by_tenant_id='fad75b91-d2eb-4805-b5a3-c19e8a073bed' and (endereco is not null or cep is not null or latitude is not null or longitude is not null or link_maps is not null)) then raise exception 'FAIL legacy bypass';end if;
end $$;

set local role authenticated;
do $$begin
 if (select count(*) from public.piloto_radar_perfis)<>1 then raise exception 'FAIL owner RLS';end if;
 if has_table_privilege(current_user,'public.piloto_radar_perfis','INSERT') or has_table_privilege(current_user,'public.piloto_radar_perfis','UPDATE') or has_table_privilege(current_user,'public.piloto_radar_perfis','DELETE') then raise exception 'FAIL direct writes allowed';end if;
end $$;
select set_config('request.jwt.claim.sub','ab2eef13-604c-4c8f-9d14-f3da41cc5a81',true);
select set_config('request.jwt.claims','{"sub":"ab2eef13-604c-4c8f-9d14-f3da41cc5a81","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.piloto_radar_perfis) then raise exception 'FAIL member RLS';end if;
 begin perform public.piloto_radar_ler('fad75b91-d2eb-4805-b5a3-c19e8a073bed');raise exception 'FAIL member read';exception when insufficient_privilege then null;end;
 begin perform public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',(select p from radar_test_profile),2);raise exception 'FAIL member write';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','fad75b91-d2eb-4805-b5a3-c19e8a073bed',true);
select set_config('request.jwt.claims','{"sub":"fad75b91-d2eb-4805-b5a3-c19e8a073bed","role":"authenticated"}',true);
do $$begin
 begin perform public.piloto_radar_ler('00000000-0000-0000-0000-000000000001');raise exception 'FAIL other tenant';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$declare r jsonb;begin
 if has_table_privilege(current_user,'public.piloto_radar_perfis','SELECT') or has_function_privilege(current_user,'public.piloto_radar_ler(uuid)','EXECUTE') then raise exception 'FAIL anon private access';end if;
 for r in select value from jsonb_array_elements(public.piloto_radar_publicos()) loop
  if r->'profile' is not null and r->'profile'<>'null'::jsonb then
   if r->'profile' ?| array['address','number','noNumber','complement','neighborhood','cep','latitude','longitude','mapsUrl'] then raise exception 'FAIL public JSON location';end if;
   if jsonb_array_length(r->'profile'->'schedules')<>1 then raise exception 'FAIL disabled schedule published';end if;
  end if;
 end loop;
end $$;
reset role;
do $$declare p jsonb;begin
 select jsonb_set(jsonb_set(t.p,'{showAddress}','false'),'{published}','false') into p from radar_test_profile t;
 perform public.piloto_radar_salvar('fad75b91-d2eb-4805-b5a3-c19e8a073bed',p,2);
 if exists(select 1 from jsonb_array_elements(public.piloto_radar_publicos()) r where r->'profile'<>'null'::jsonb) then raise exception 'FAIL unpublished profile';end if;
end $$;
rollback;
