begin;
create table if not exists public.financeiro_revisoes (
  tenant_id uuid primary key,
  revisao bigint not null default 0 check (revisao >= 0)
);
alter table public.financeiro_revisoes enable row level security;
revoke all on public.financeiro_revisoes from public, anon, authenticated;
grant select on public.financeiro_revisoes to service_role;

create or replace function public.registrar_revisao_financeiro()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ref uuid; v_refs uuid[] := '{}';
begin
  if tg_op <> 'INSERT' then v_refs := v_refs || array[old.tenant_id,old.lider_id]; end if;
  if tg_op <> 'DELETE' then v_refs := v_refs || array[new.tenant_id,new.lider_id]; end if;
  for v_ref in select distinct ref from unnest(v_refs) ref where ref is not null order by ref loop
    insert into public.financeiro_revisoes(tenant_id,revisao) values(v_ref,1)
      on conflict(tenant_id) do update set revisao=financeiro_revisoes.revisao+1;
  end loop;
  return null;
end; $$;
revoke all on function public.registrar_revisao_financeiro() from public,anon,authenticated;
drop trigger if exists financeiro_registrar_revisao on public.financeiro;
create trigger financeiro_registrar_revisao after insert or update or delete on public.financeiro
  for each row execute function public.registrar_revisao_financeiro();
commit;
