-- Portal do consulente, tradição da casa e pedidos de reza

alter table public.perfil_lider
  add column if not exists tradicao text not null default 'mista',
  add column if not exists public_slug text,
  add column if not exists portal_consulente_ativo boolean not null default false,
  add column if not exists portal_consulente_mensagem text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perfil_lider_tradicao_check'
      and conrelid = 'public.perfil_lider'::regclass
  ) then
    alter table public.perfil_lider
      add constraint perfil_lider_tradicao_check
      check (tradicao in ('umbanda', 'candomble', 'jurema', 'mista', 'outra'));
  end if;
exception
  when others then
    raise notice 'perfil_lider_tradicao_check: %', sqlerrm;
end $$;

create unique index if not exists perfil_lider_public_slug_unique
  on public.perfil_lider (lower(public_slug))
  where public_slug is not null and btrim(public_slug) <> '';

create table if not exists public.pedidos_reza (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tenant_id uuid not null,
  lider_id uuid not null,
  nome text not null,
  whatsapp text,
  mensagem text not null,
  status text not null default 'pendente',
  observacao_interna text,
  constraint pedidos_reza_status_check
    check (status in ('pendente', 'em_atendimento', 'concluido', 'cancelado'))
);

create index if not exists pedidos_reza_tenant_created_idx
  on public.pedidos_reza (tenant_id, created_at desc);

create index if not exists pedidos_reza_lider_created_idx
  on public.pedidos_reza (lider_id, created_at desc);

create index if not exists pedidos_reza_status_idx
  on public.pedidos_reza (tenant_id, status);

alter table public.pedidos_reza enable row level security;

drop policy if exists "pedidos_reza_select_gestor" on public.pedidos_reza;
create policy "pedidos_reza_select_gestor"
  on public.pedidos_reza for select to authenticated
  using (
    (select auth_is_global_admin())
    or lider_id = (select auth.uid())
    or tenant_id in (select auth_user_tenant_ids())
  );

drop policy if exists "pedidos_reza_update_gestor" on public.pedidos_reza;
create policy "pedidos_reza_update_gestor"
  on public.pedidos_reza for update to authenticated
  using (
    (select auth_is_global_admin())
    or lider_id = (select auth.uid())
    or tenant_id in (select auth_user_tenant_ids())
  )
  with check (
    (select auth_is_global_admin())
    or lider_id = (select auth.uid())
    or tenant_id in (select auth_user_tenant_ids())
  );
