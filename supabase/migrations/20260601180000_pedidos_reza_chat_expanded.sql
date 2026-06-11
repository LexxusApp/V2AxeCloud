-- Pedidos de reza: campos litúrgicos, token público e chat pastoral

alter table public.pedidos_reza
  add column if not exists categoria text,
  add column if not exists linha text,
  add column if not exists vela text,
  add column if not exists nome_terreiro text,
  add column if not exists acesso_token text;

create unique index if not exists pedidos_reza_acesso_token_unique
  on public.pedidos_reza (acesso_token)
  where acesso_token is not null and btrim(acesso_token) <> '';

alter table public.pedidos_reza drop constraint if exists pedidos_reza_status_check;

update public.pedidos_reza
  set status = 'em_oracao'
  where status = 'em_atendimento';

alter table public.pedidos_reza
  add constraint pedidos_reza_status_check
  check (status in ('pendente', 'aceito', 'em_oracao', 'concluido', 'cancelado'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pedidos_reza_vela_check'
      and conrelid = 'public.pedidos_reza'::regclass
  ) then
    alter table public.pedidos_reza
      add constraint pedidos_reza_vela_check
      check (
        vela is null
        or vela in ('Branca', 'Vermelha', 'Azul', 'Verde', 'Amarela', 'Preta', 'Nenhuma')
      );
  end if;
exception
  when others then
    raise notice 'pedidos_reza_vela_check: %', sqlerrm;
end $$;

create table if not exists public.pedidos_reza_mensagens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pedido_id uuid not null references public.pedidos_reza (id) on delete cascade,
  sender text not null,
  texto text not null,
  constraint pedidos_reza_mensagens_sender_check
    check (sender in ('zelador', 'visitante', 'sistema'))
);

create index if not exists pedidos_reza_mensagens_pedido_created_idx
  on public.pedidos_reza_mensagens (pedido_id, created_at asc);

alter table public.pedidos_reza_mensagens enable row level security;

drop policy if exists "pedidos_reza_mensagens_select_gestor" on public.pedidos_reza_mensagens;
create policy "pedidos_reza_mensagens_select_gestor"
  on public.pedidos_reza_mensagens for select to authenticated
  using (
    exists (
      select 1
      from public.pedidos_reza p
      where p.id = pedido_id
        and (
          (select auth_is_global_admin())
          or p.lider_id = (select auth.uid())
          or p.tenant_id in (select auth_user_tenant_ids())
        )
    )
  );

drop policy if exists "pedidos_reza_mensagens_insert_gestor" on public.pedidos_reza_mensagens;
create policy "pedidos_reza_mensagens_insert_gestor"
  on public.pedidos_reza_mensagens for insert to authenticated
  with check (
    exists (
      select 1
      from public.pedidos_reza p
      where p.id = pedido_id
        and (
          (select auth_is_global_admin())
          or p.lider_id = (select auth.uid())
          or p.tenant_id in (select auth_user_tenant_ids())
        )
    )
  );
