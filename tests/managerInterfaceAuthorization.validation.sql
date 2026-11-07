do $$
declare
 pilot constant uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';
 other_manager uuid;
 active_member uuid;
 radar_fixture jsonb;
 fixed_count integer;
begin
 select p.id into other_manager
 from public.perfil_lider p join auth.users u on u.id=p.id
 join public.terreiros_diretorio d on d.claimed_by_tenant_id=p.id and d.slug is not null
 where p.id<>pilot
  and coalesce(nullif(to_jsonb(p)->>'tenant_id',''),p.id::text)=p.id::text
  and lower(coalesce(nullif(to_jsonb(p)->>'role',''),'')) in ('admin','zelador','lider','leader')
  and lower(coalesce(to_jsonb(p)->>'status','')) not in ('blocked','deleted')
  and coalesce((to_jsonb(p)->>'is_blocked')::boolean,false)=false
  and nullif(to_jsonb(p)->>'deleted_at','') is null
  and not exists(select 1 from public.subscriptions s where s.id=p.id and
   (lower(coalesce(to_jsonb(s)->>'status','')) in ('blocked','deleted') or lower(coalesce(to_jsonb(s)->>'role',''))='filho'))
 order by p.id limit 1;
 if other_manager is null then raise exception 'VALIDATION: no second active manager fixture';end if;
 perform set_config('validation.manager_id',other_manager::text,true);
 select profile into radar_fixture from public.piloto_radar_perfis order by updated_at desc limit 1;
 if radar_fixture is null then radar_fixture:=jsonb_build_object(
  'publicName','Casa de validação','tradition','Umbanda','description','Perfil criado apenas no rollback de validação.',
  'instructions','Confirme a visita diretamente com a casa.','address','Rua de validação','number','1','noNumber',false,
  'complement','','neighborhood','Bairro de validação','cep','01001-000','city','São Paulo','uf','SP',
  'phone','11900000000','servicePhone','11911111111','mapsUrl','','latitude','','longitude','','showAddress',false,
  'socials','[]'::jsonb,'schedules','[]'::jsonb,
  'cover',jsonb_build_object('id','cover','source','https://axecloud.com.br/trident-cropped.png','caption','','illustrative',true),
  'portrait',jsonb_build_object('id','portrait','source','https://axecloud.com.br/trident-cropped.png','caption','','illustrative',true),
  'gallery','[]'::jsonb,'coverPosition','center','published',false);
 end if;
 perform set_config('validation.radar_profile',radar_fixture::text,true);

 perform set_config('request.jwt.claims',jsonb_build_object('sub',other_manager,'role','authenticated')::text,true);
 if not public.piloto_zelador_ativo(other_manager) then raise exception 'VALIDATION: second manager was denied';end if;
 if public.piloto_validar_zelador(other_manager) is distinct from other_manager then raise exception 'VALIDATION: manager identity changed';end if;
 if not public.piloto_comunicados_zelador_ativo(other_manager) then raise exception 'VALIDATION: notices denied second manager';end if;
 if public.piloto_comunicados_autorizar(other_manager,true) is distinct from other_manager then raise exception 'VALIDATION: notices changed manager identity';end if;
 perform public.piloto_radar_autorizar(other_manager);
 begin
  perform public.piloto_validar_zelador(pilot);
  raise exception 'VALIDATION: cross-tenant manager accepted';
 exception when insufficient_privilege then null;
 end;

 select f.user_id into active_member from public.filhos_de_santo f
 where f.user_id is not null and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active')
 order by f.id limit 1;
 if active_member is not null then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',active_member,'role','authenticated')::text,true);
  if public.piloto_zelador_ativo(active_member) then raise exception 'VALIDATION: member accepted as manager';end if;
 end if;

 select count(*) into fixed_count from pg_constraint
 where connamespace='public'::regnamespace and conname in (
  'piloto_biblioteca_privada_tenant_id_check','piloto_comunicados_tenant_id_check',
  'piloto_comunicados_envios_tenant_id_check','piloto_radar_perfis_tenant_id_check');
 if fixed_count<>0 then raise exception 'VALIDATION: fixed tenant constraints remain';end if;

 select count(*) into fixed_count from pg_policies
 where policyname in (
  'pilot_owner_read','piloto_estoque_metadata_read','piloto_estoque_history_read',
  'piloto_financeiro_own_read','piloto_radar_owner_read','pilot_owner_store_images',
  'pilot_notice_owner_read','pilot_notice_delivery_owner_read',
  'pilot_pdf_insert','pilot_pdf_read','pilot_pdf_delete','pilot_pdf_read_guard',
  'pilot_pdf_insert_guard','pilot_pdf_update_guard','pilot_pdf_delete_guard','pilot_pdf_operation_guard')
 and (coalesce(qual,'') like '%'||pilot::text||'%' or coalesce(with_check,'') like '%'||pilot::text||'%');
 if fixed_count<>0 then raise exception 'VALIDATION: fixed tenant policy remains';end if;

 select count(*) into fixed_count from pg_policies
 where (policyname like 'pilot%' or policyname like 'piloto%')
  and (coalesce(qual,'') like '%'||pilot::text||'%' or coalesce(with_check,'') like '%'||pilot::text||'%');
 if fixed_count<>0 then raise exception 'VALIDATION: another pilot policy still contains the manager tenant';end if;

 select count(*) into fixed_count
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
  'piloto_zelador_ativo','piloto_validar_zelador','piloto_pode_ler_pdf',
  'piloto_biblioteca_revisoes_disponiveis','piloto_finalizar_pdf','piloto_revisar_pdf',
  'piloto_comunicados_zelador_ativo','piloto_comunicados_membro','piloto_comunicados_autorizar',
  'piloto_comunicados_listar','piloto_radar_autorizar','piloto_radar_projetar_legado',
  'piloto_radar_proteger_bairro_portal','piloto_radar_publicos','piloto_cancelar_entrega_com_pedido')
 and pg_get_functiondef(p.oid) like '%'||pilot::text||'%';
 if fixed_count<>0 then raise exception 'VALIDATION: fixed tenant function remains';end if;

 select count(*) into fixed_count
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'piloto_%'
  and p.proname not in ('piloto_registrar_envio_comprovante','piloto_preservar_cobranca_comprovante')
  and pg_get_functiondef(p.oid) like '%'||pilot::text||'%';
 if fixed_count<>0 then raise exception 'VALIDATION: another manager operation still contains the pilot tenant';end if;
end $$;

-- Exercise the real authenticated grants and RLS with disposable writes. The
-- surrounding runner always rolls the transaction back.
select set_config('request.jwt.claims',jsonb_build_object(
 'sub',current_setting('validation.manager_id'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare actor uuid:=auth.uid();notice_id uuid:=gen_random_uuid();saved jsonb;listed jsonb;
 profile jsonb:=current_setting('validation.radar_profile')::jsonb;radar jsonb;foreign_rows integer;
begin
 saved:=public.piloto_comunicados_salvar(actor,jsonb_build_object(
  'id',notice_id,'title','Validação transacional','body','Comunicado criado apenas dentro do rollback de validação.',
  'audience','all','memberIds','[]'::jsonb,'giraId','','status','draft','category','Geral','expires',''),null);
 if saved->>'id' is distinct from notice_id::text then raise exception 'VALIDATION: notice write was not confirmed';end if;
 listed:=public.piloto_comunicados_listar(actor);
 if not exists(select 1 from jsonb_array_elements(listed->'data') row where row->>'id'=notice_id::text) then
  raise exception 'VALIDATION: notice read did not return own write';end if;
 select count(*) into foreign_rows from public.piloto_comunicados where tenant_id<>actor;
 if foreign_rows<>0 then raise exception 'VALIDATION: notice RLS exposed another tenant';end if;

 profile:=profile||jsonb_build_object('publicName','Validação '||left(actor::text,8),'mapsUrl','',
  'showAddress',false,'published',false);
 select public.piloto_radar_salvar(actor,profile,coalesce((select revision from public.piloto_radar_perfis where tenant_id=actor),0)) into radar;
 if radar->>'profile' is null or (radar->>'revision')::integer<1 then raise exception 'VALIDATION: Radar write was not confirmed';end if;
 select count(*) into foreign_rows from public.piloto_radar_perfis where tenant_id<>actor;
 if foreign_rows<>0 then raise exception 'VALIDATION: Radar RLS exposed another tenant';end if;
end $$;
reset role;

select 'passed' as manager_interface_authorization_validation;
