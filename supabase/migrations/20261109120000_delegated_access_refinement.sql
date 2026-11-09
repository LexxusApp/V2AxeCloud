begin;

-- Keep existing RPC/table names for deployed clients. Every grant is scoped
-- to the actual owner and a currently active, JWT-linked member of that house.
alter table public.piloto_coadministradores drop constraint if exists piloto_coadministradores_tenant_id_check;
alter table public.piloto_coadministradores_auditoria drop constraint if exists piloto_coadministradores_auditoria_tenant_id_check;
create unique index if not exists piloto_coadmin_active_user_idx on public.piloto_coadministradores(tenant_id,user_id)
 where ativo and user_id is not null;

create or replace function public.piloto_tem_permissao(p_tenant uuid,p_user uuid,p_modulo text,p_acao text default 'visualizar')
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_user=(select auth.uid()) and p_user<>p_tenant
 and p_modulo=any(array['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar'])
 and p_acao in ('visualizar','gerenciar')
 and exists(
  select 1 from public.piloto_coadministradores c
  join public.filhos_de_santo f on f.id=c.filho_id and f.user_id=c.user_id and f.tenant_id=c.tenant_id
  join public.perfil_lider p on p.id=c.tenant_id
  where c.tenant_id=p_tenant and c.user_id=p_user and c.ativo
   and lower(btrim(coalesce(f.status,''))) in ('ativo','active')
   and coalesce((to_jsonb(p)->>'is_blocked')::boolean,false)=false
   and nullif(to_jsonb(p)->>'deleted_at','') is null
   and (c.permissoes->>p_modulo='gerenciar' or (p_acao='visualizar' and c.permissoes->>p_modulo='visualizar'))
 );
$$;

create or replace function public.piloto_is_coadministrador(p_tenant uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from unnest(array['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar']) m
 where public.piloto_tem_permissao(p_tenant,p_user,m,'visualizar'));
$$;

-- Never put delegates into the legacy blanket leader scope, including after
-- revocation. Granular policies below supply only the selected modules.
create or replace function axecloud_private.auth_lider_tenant_ids()
returns setof uuid language sql stable security definer set search_path=public,axecloud_private,pg_temp as $$
 select coalesce(p.tenant_id,p.id) from public.perfil_lider p
 where p.id=(select auth.uid()) and (coalesce(p.tenant_id,p.id)=p.id or not exists(
  select 1 from public.piloto_coadministradores c where c.user_id=p.id
 ))
 and lower(coalesce(to_jsonb(p)->>'role','')) in ('admin','zelador','lider','leader')
 and coalesce((to_jsonb(p)->>'is_blocked')::boolean,false)=false
 and nullif(to_jsonb(p)->>'deleted_at','') is null;
$$;

drop policy if exists pilot_coadmin_owner_read on public.piloto_coadministradores;
create policy pilot_coadmin_owner_read on public.piloto_coadministradores for select to authenticated
 using (tenant_id=(select auth.uid()) or user_id=(select auth.uid()));
drop policy if exists piloto_coadmin_auditoria_titular_read on public.piloto_coadministradores_auditoria;
create policy piloto_coadmin_auditoria_titular_read on public.piloto_coadministradores_auditoria for select to authenticated
 using (tenant_id=(select auth.uid()));

create or replace function public.piloto_salvar_permissoes_coadministrador(p_tenant uuid,p_filho_id uuid,p_permissoes jsonb,p_ativo boolean default true)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.filhos_de_santo; old public.piloto_coadministradores; k text; v jsonb; before_state jsonb:='{}';
begin
 if not public.piloto_zelador_ativo(p_tenant) then raise exception 'Somente o zelador titular pode alterar permissões' using errcode='42501';end if;
 if p_ativo is null or jsonb_typeof(p_permissoes) is distinct from 'object' then raise exception 'Formato de permissões inválido' using errcode='22023';end if;
 for k,v in select * from jsonb_each(p_permissoes) loop
  if k<>all(array['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar'])
   or jsonb_typeof(v)<>'string' or v#>>'{}' not in ('visualizar','gerenciar') then
   raise exception 'Permissão inválida: %',k using errcode='22023';end if;
 end loop;
 if p_ativo and p_permissoes='{}'::jsonb then raise exception 'Escolha pelo menos uma área' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':coadmin:'||p_filho_id::text,0));
 select * into f from public.filhos_de_santo where id=p_filho_id and tenant_id=p_tenant for share;
 if not found then raise exception 'Membro não pertence a esta casa' using errcode='42501';end if;
 if p_ativo and (f.user_id is null or f.user_id=p_tenant) then raise exception 'O membro precisa ter uma conta própria ativada' using errcode='22023';end if;
 if p_ativo and lower(btrim(coalesce(f.status,''))) not in ('ativo','active') then raise exception 'Membro inativo não pode receber acesso' using errcode='22023';end if;
 if f.user_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':coadmin-user:'||f.user_id::text,0));
  if p_ativo and exists(select 1 from public.piloto_coadministradores c where c.tenant_id=p_tenant and c.user_id=f.user_id and c.filho_id<>p_filho_id and c.ativo) then
   raise exception 'Esta conta já tem acesso de gestão em outro cadastro da casa. Revise o cadastro duplicado antes de conceder acesso.' using errcode='22023';end if;
 end if;
 select * into old from public.piloto_coadministradores where tenant_id=p_tenant and filho_id=p_filho_id for update;
 if found then before_state:=jsonb_build_object('ativo',old.ativo,'permissoes',old.permissoes);end if;
 insert into public.piloto_coadministradores(tenant_id,filho_id,user_id,ativo,cargo_delegado,permissoes,updated_at)
 values(p_tenant,p_filho_id,f.user_id,p_ativo,'Co-Administrador',p_permissoes,now())
 on conflict(tenant_id,filho_id) do update set user_id=excluded.user_id,ativo=excluded.ativo,permissoes=excluded.permissoes,updated_at=now();
 insert into public.piloto_coadministradores_auditoria(tenant_id,filho_id,actor_user_id,before_state,after_state)
 values(p_tenant,p_filho_id,auth.uid(),before_state,jsonb_build_object('ativo',p_ativo,'permissoes',p_permissoes));
 return jsonb_build_object('ok',true,'filho_id',p_filho_id,'user_id',f.user_id,'nome',f.nome,'ativo',p_ativo,'permissoes',p_permissoes);
end;
$$;

create or replace function public.piloto_definir_coadministrador(p_tenant uuid,p_filho_id uuid,p_ativo boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rights jsonb;
begin
 if p_ativo is distinct from false then raise exception 'Escolha as permissões no modal de co-admin' using errcode='42501';end if;
 select permissoes into rights from public.piloto_coadministradores where tenant_id=p_tenant and filho_id=p_filho_id;
 return public.piloto_salvar_permissoes_coadministrador(p_tenant,p_filho_id,coalesce(rights,'{}'),false);
end;
$$;

create or replace function public.piloto_listar_coadministradores(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.piloto_zelador_ativo(p_tenant) then raise exception 'Somente o titular pode consultar os acessos da equipe' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.filho_id,'filho_id',c.filho_id,'user_id',c.user_id,'nome',f.nome,'email',f.email,'cargo',f.cargo,
 'ativo',c.ativo,'cargo_delegado',c.cargo_delegado,'permissoes',c.permissoes,'updated_at',c.updated_at) order by c.updated_at desc),'[]')
 into result from public.piloto_coadministradores c join public.filhos_de_santo f on f.id=c.filho_id and f.tenant_id=c.tenant_id where c.tenant_id=p_tenant;
 return jsonb_build_object('data',result);
end;
$$;

-- Names needed to operate a granted module do not grant the member profile
-- screen, CPF, contact details, private notes, or other religious information.
create or replace function public.piloto_referencias_membros(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.piloto_zelador_ativo(p_tenant) and not exists(select 1 from unnest(array['members','giras','finance','cantina','communications','library','store']) m
 where public.piloto_tem_permissao(p_tenant,auth.uid(),m,'visualizar')) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'nome',f.nome,'cargo',f.cargo,'status',f.status) order by f.nome),'[]') into result
 from public.filhos_de_santo f where f.tenant_id=p_tenant;
 return result;
end;
$$;

create or replace function public.piloto_referencias_giras(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not public.piloto_zelador_ativo(p_tenant) and not public.piloto_tem_permissao(p_tenant,auth.uid(),'communications','visualizar') then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'titulo',e.titulo,'data',e.data,'hora',e.hora,'tipo',e.tipo) order by e.data desc),'[]') into result
 from public.calendario_axe e where e.tenant_id=p_tenant and e.tipo<>'Obrigação';
 return result;
end;
$$;

create or replace function public.piloto_cantina_lancamentos(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.piloto_validar_modulo(p_tenant,'cantina','visualizar');
 select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') into result from public.financeiro f
 where (f.tenant_id=p_tenant or (f.tenant_id is null and f.lider_id=p_tenant)) and f.categoria='Cantina';
 return result;
end;
$$;
revoke all on function public.piloto_cantina_lancamentos(uuid) from public,anon;
grant execute on function public.piloto_cantina_lancamentos(uuid) to authenticated,service_role;

create or replace function public.piloto_credito_loja(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.piloto_validar_modulo(p_tenant,'store','visualizar');
 select coalesce(jsonb_object_agg(r.id,jsonb_build_object('limitCents',r.limit_cents,'blocked',r.blocked,'outstandingCents',r.outstanding)),'{}') into result from (
  select f.id,round(coalesce(f.limite_lojinha,100)*100) as limit_cents,coalesce(f.bloquear_fiado_loja,false) as blocked,
  round(coalesce(sum(t.valor),0)*100) as outstanding from public.filhos_de_santo f
  left join public.financeiro t on t.filho_id=f.id and t.tenant_id=p_tenant and t.categoria in ('Cantina','Loja') and t.status='pendente'
  where f.tenant_id=p_tenant group by f.id
 ) r;
 return result;
end;
$$;
revoke all on function public.piloto_credito_loja(uuid) from public,anon;
grant execute on function public.piloto_credito_loja(uuid) to authenticated,service_role;

revoke all on function public.piloto_referencias_membros(uuid),public.piloto_referencias_giras(uuid) from public,anon;
grant execute on function public.piloto_referencias_membros(uuid),public.piloto_referencias_giras(uuid) to authenticated,service_role;

-- Extend only the named granular policies, preserving their module/action
-- checks and every existing member self-access policy. No grant is backfilled.
do $$
declare p record; q text; c text;
begin
 for p in select * from pg_policies where schemaname='public' and policyname in ('pilot_granular_read','pilot_granular_insert','pilot_granular_update','pilot_granular_delete') loop
  q:=regexp_replace(p.qual,'\(?[a-z_\.]*tenant_id = ''fad75b91-d2eb-4805-b5a3-c19e8a073bed''::uuid\)?','true','g');
  c:=regexp_replace(p.with_check,'\(?[a-z_\.]*tenant_id = ''fad75b91-d2eb-4805-b5a3-c19e8a073bed''::uuid\)?','true','g');
  execute format('alter policy %I on public.%I%s%s',p.policyname,p.tablename,
    case when q is not null then ' using ('||q||')' else '' end,
    case when c is not null then ' with check ('||c||')' else '' end);
 end loop;
end $$;

-- Names and customer data used by these modules stay protected by module
-- policies, even when the underlying table also serves another screen.
drop policy if exists delegated_store_deliveries_read on public.piloto_entregas_pedidos;
create policy delegated_store_deliveries_read on public.piloto_entregas_pedidos for select to authenticated
 using(public.piloto_tem_permissao(tenant_id,auth.uid(),'store','visualizar'));
drop policy if exists delegated_communications_logs_read on public.whatsapp_logs;
create policy delegated_communications_logs_read on public.whatsapp_logs for select to authenticated
 using(public.piloto_tem_permissao(tenant_id,auth.uid(),'communications','visualizar'));

create or replace function public.piloto_biblioteca_gestor_tenant()
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tenant uuid;
begin
 if public.piloto_zelador_ativo(auth.uid()) then return auth.uid();end if;
 select c.tenant_id into tenant from public.piloto_coadministradores c
 where c.user_id=auth.uid() and public.piloto_tem_permissao(c.tenant_id,auth.uid(),'library','gerenciar');
 if tenant is null then raise exception 'A biblioteca não está liberada para gerenciamento' using errcode='42501';end if;
 return tenant;
end;
$$;
revoke all on function public.piloto_biblioteca_gestor_tenant() from public,anon;
grant execute on function public.piloto_biblioteca_gestor_tenant() to authenticated;

-- Preserve the existing immutable PDF publication/revision logic; change only
-- its authorization and the canonical tenant used in the protected path.
do $$
declare f record; definition text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('piloto_revisar_pdf','piloto_finalizar_pdf','piloto_radar_ler') loop
  definition:=pg_get_functiondef(f.oid);
  if f.proname='piloto_radar_ler' then
   definition:=replace(definition,'perform public.piloto_radar_autorizar(p_tenant);','perform public.piloto_validar_modulo(p_tenant,''radar'',''visualizar'');');
  else
   if position('owner_id:=public.piloto_validar_zelador(auth.uid());' in definition)=0 and position('owner_id:=public.piloto_biblioteca_gestor_tenant();' in definition)=0 then raise exception 'Biblioteca: revisar autorização da função % antes da migração',f.proname;end if;
   definition:=replace(definition,'owner_id:=public.piloto_validar_zelador(auth.uid());','owner_id:=public.piloto_biblioteca_gestor_tenant();');
  end if;
  execute definition;
 end loop;
end $$;

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.piloto_salvar_estoque(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure);
 definition:=replace(definition,'values(p_item,actor,p_tenant,','values(p_item,p_tenant,p_tenant,');
 execute definition;
end $$;

create or replace function public.piloto_pode_ler_pdf(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.piloto_biblioteca_privada b where b.id=p_id and (
  public.piloto_zelador_ativo(b.tenant_id)
  or public.piloto_tem_permissao(b.tenant_id,auth.uid(),'library','visualizar')
  or (b.retired_at is null and exists(select 1 from public.filhos_de_santo f
   where f.tenant_id=b.tenant_id and f.user_id=auth.uid() and lower(btrim(coalesce(f.status,''))) in ('ativo','active')
   and (b.visibilidade='casa' or b.destinatario=f.id)))
 ));
$$;
drop policy if exists delegated_library_delete on public.piloto_biblioteca_privada;
create policy delegated_library_delete on public.piloto_biblioteca_privada for delete to authenticated
 using(public.piloto_tem_permissao(tenant_id,auth.uid(),'library','gerenciar'));

-- The bucket remains private. Signing reusable URLs and overwriting published
-- objects remain prohibited; only authenticated reads and new revisions work.
create or replace function public.piloto_pdf_pode_gerenciar(p_path text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.perfil_lider p where p.id::text=split_part(p_path,'/',1)
 and (public.piloto_zelador_ativo(p.id) or public.piloto_tem_permissao(p.id,auth.uid(),'library','gerenciar')));
$$;
revoke all on function public.piloto_pdf_pode_gerenciar(text) from public,anon;
grant execute on function public.piloto_pdf_pode_gerenciar(text) to authenticated;
drop policy if exists delegated_pdf_insert on storage.objects;
create policy delegated_pdf_insert on storage.objects for insert to authenticated
 with check(bucket_id='piloto_biblioteca_privada' and public.piloto_pdf_pode_gerenciar(name));
drop policy if exists delegated_pdf_delete on storage.objects;
create policy delegated_pdf_delete on storage.objects for delete to authenticated
 using(bucket_id='piloto_biblioteca_privada' and public.piloto_pdf_pode_gerenciar(name));
drop policy if exists pilot_pdf_insert_guard on storage.objects;
create policy pilot_pdf_insert_guard on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'piloto_biblioteca_privada' or public.piloto_pdf_pode_gerenciar(name));
drop policy if exists pilot_pdf_delete_guard on storage.objects;
create policy pilot_pdf_delete_guard on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'piloto_biblioteca_privada' or public.piloto_pdf_pode_gerenciar(name));
drop policy if exists pilot_pdf_operation_guard on storage.objects;
create policy pilot_pdf_operation_guard on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'piloto_biblioteca_privada' or storage.allow_only_operation('object.get_authenticated')
 or (public.piloto_pdf_pode_gerenciar(name) and storage.allow_any_operation(array['object.upload','object.delete','object.delete_many'])));

commit;
