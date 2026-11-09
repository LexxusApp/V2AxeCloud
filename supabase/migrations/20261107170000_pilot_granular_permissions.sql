begin;

-- AxéCloud V2: delegação granular, piloto isolado.
-- Não modifica as regras efetivas de RLS nesta etapa de preparação.
alter table public.piloto_coadministradores
 add column if not exists permissoes jsonb not null default '{}'::jsonb;

create table if not exists public.piloto_coadministradores_auditoria (
 id bigint generated always as identity primary key,
 tenant_id uuid not null check (tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid),
 filho_id uuid not null,
 actor_user_id uuid not null,
 before_state jsonb not null,
 after_state jsonb not null,
 criado_em timestamptz not null default now()
);
alter table public.piloto_coadministradores_auditoria enable row level security;
revoke all on public.piloto_coadministradores_auditoria from public,anon,authenticated;
grant select on public.piloto_coadministradores_auditoria to authenticated;
drop policy if exists piloto_coadmin_auditoria_titular_read on public.piloto_coadministradores_auditoria;
create policy piloto_coadmin_auditoria_titular_read on public.piloto_coadministradores_auditoria for select to authenticated
 using (tenant_id = (select auth.uid()) and tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);

-- Preserva exatamente os acessos dos delegados que já estavam ativos. Novos
-- delegados sempre exigirão seleção explícita pelo zelador.
update public.piloto_coadministradores
 set permissoes = '{
 "members":"gerenciar","giras":"gerenciar","finance":"gerenciar",
 "cantina":"gerenciar","inventory":"gerenciar","communications":"gerenciar",
 "gallery":"gerenciar","library":"gerenciar","store":"gerenciar","radar":"gerenciar"
 }'::jsonb
 where tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
   and ativo = true and permissoes = '{}'::jsonb;

create or replace function public.piloto_tem_permissao(
 p_tenant uuid, p_user uuid, p_modulo text, p_acao text default 'visualizar'
) returns boolean language sql stable security definer set search_path = public,pg_temp as $$
 select p_tenant = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
   and p_user = (select auth.uid())
   and p_modulo = any(array['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar'])
   and p_acao in ('visualizar','gerenciar')
   and exists(
     select 1 from public.piloto_coadministradores c
     where c.tenant_id = p_tenant and c.user_id = p_user and c.ativo = true
       and (c.permissoes->>p_modulo = 'gerenciar'
         or (p_acao = 'visualizar' and c.permissoes->>p_modulo = 'visualizar'))
   );
$$;
revoke all on function public.piloto_tem_permissao(uuid,uuid,text,text) from public,anon;
grant execute on function public.piloto_tem_permissao(uuid,uuid,text,text) to authenticated,service_role;

create or replace function public.piloto_salvar_permissoes_coadministrador(
 p_tenant uuid, p_filho_id uuid, p_permissoes jsonb, p_ativo boolean default true
) returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare
 v_filho record;
 v_before jsonb := '{}'::jsonb;
 v_clean jsonb := '{}'::jsonb;
 v_k text;
 v_v text;
 v_old record;
begin
 if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
    or (select auth.uid()) is distinct from p_tenant
 then raise exception 'Somente o zelador titular deste piloto pode alterar permissões' using errcode='42501'; end if;
 if p_permissoes is null or jsonb_typeof(p_permissoes) <> 'object'
 then raise exception 'Formato de permissões inválido' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(p_permissoes)) > 10
 then raise exception 'Módulos de permissão inválidos' using errcode='22023'; end if;
 for v_k,v_v in select key,value from jsonb_each_text(p_permissoes) loop
   if not(v_k = any(array['members','giras','finance','cantina','inventory','communications','gallery','library','store','radar']))
      or v_v not in ('visualizar','gerenciar')
   then raise exception 'Permissão inválida: %',v_k using errcode='22023'; end if;
   v_clean := v_clean || jsonb_build_object(v_k,v_v);
 end loop;
 if p_ativo and v_clean = '{}'::jsonb
 then raise exception 'Escolha pelo menos um módulo antes de conceder acesso' using errcode='22023'; end if;
 select id,user_id,nome,email,status into v_filho
 from public.filhos_de_santo where id=p_filho_id and tenant_id=p_tenant for share;
 if not found then raise exception 'Membro não pertence a esta casa' using errcode='22023'; end if;
 if p_ativo and lower(coalesce(v_filho.status,'')) in ('inativo','bloqueado','excluido','excluído')
 then raise exception 'Membro inativo não pode receber acessos' using errcode='22023'; end if;
 if p_ativo and v_filho.user_id is null
 then raise exception 'Este membro precisa ativar a conta antes de receber permissões' using errcode='22023'; end if;
 select ativo,permissoes,user_id into v_old from public.piloto_coadministradores
 where tenant_id=p_tenant and filho_id=p_filho_id for update;
 if found then v_before:=jsonb_build_object('ativo',v_old.ativo,'permissoes',v_old.permissoes); end if;
 insert into public.piloto_coadministradores(tenant_id,filho_id,user_id,ativo,cargo_delegado,permissoes,updated_at)
 values(p_tenant,p_filho_id,v_filho.user_id,p_ativo,'Responsável pelo sistema',v_clean,now())
 on conflict(tenant_id,filho_id) do update set
   user_id=excluded.user_id,ativo=excluded.ativo,permissoes=excluded.permissoes,updated_at=now();
 insert into public.piloto_coadministradores_auditoria(tenant_id,filho_id,actor_user_id,before_state,after_state)
 values(p_tenant,p_filho_id,auth.uid(),v_before,jsonb_build_object('ativo',p_ativo,'permissoes',v_clean));
 return jsonb_build_object('ok',true,'filho_id',p_filho_id,'nome',v_filho.nome,'ativo',p_ativo,'permissoes',v_clean);
end;
$$;
revoke all on function public.piloto_salvar_permissoes_coadministrador(uuid,uuid,jsonb,boolean) from public,anon;
grant execute on function public.piloto_salvar_permissoes_coadministrador(uuid,uuid,jsonb,boolean) to authenticated,service_role;

-- A API de listagem devolve o mapa de permissões de cada responsável.
create or replace function public.piloto_listar_coadministradores(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path = public,pg_temp as $$
declare v_res jsonb;
begin
 if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 or (select auth.uid()) is distinct from p_tenant
 then raise exception 'Somente o titular pode consultar a equipe e seus privilégios' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'filho_id',c.filho_id,'id',c.filho_id,'user_id',c.user_id,
 'nome',f.nome,'email',f.email,'cargo',f.cargo,'ativo',c.ativo,
 'cargo_delegado',c.cargo_delegado,'permissoes',c.permissoes,'updated_at',c.updated_at
 ) order by c.updated_at desc),'[]'::jsonb)
 into v_res from public.piloto_coadministradores c
 join public.filhos_de_santo f on f.id=c.filho_id
 where c.tenant_id=p_tenant;
 return jsonb_build_object('data',v_res);
end;
$$;
revoke all on function public.piloto_listar_coadministradores(uuid) from public,anon;
grant execute on function public.piloto_listar_coadministradores(uuid) to authenticated,service_role;

-- O RPC legado não pode ativar um coadmin sem definir direitos individuais.
-- Revogar permanece disponível para clientes antigos.
create or replace function public.piloto_definir_coadministrador(
 p_tenant uuid,p_filho_id uuid,p_ativo boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_ativo then raise exception 'Selecione as permissões pelo novo modal de acessos' using errcode='42501'; end if;
 if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
 or (select auth.uid()) is distinct from p_tenant
 then raise exception 'Somente o zelador titular pode revogar o acesso' using errcode='42501'; end if;
 update public.piloto_coadministradores set ativo=false,updated_at=now()
 where tenant_id=p_tenant and filho_id=p_filho_id;
 return jsonb_build_object('ok',true,'filho_id',p_filho_id,'ativo',false);
end;
$$;
revoke all on function public.piloto_definir_coadministrador(uuid,uuid,boolean) from public,anon;
grant execute on function public.piloto_definir_coadministrador(uuid,uuid,boolean) to authenticated,service_role;
commit;
