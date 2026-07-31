-- Ciclos de preceito: estado temporario da casa com participantes materializados,
-- confirmacao de leitura, dispensa e pedido privado de orientacao.

create table if not exists public.preceito_ciclos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  criado_por uuid not null,
  titulo text not null check (char_length(trim(titulo)) between 3 and 140),
  motivo text,
  orientacoes text not null check (char_length(trim(orientacoes)) between 3 and 30000),
  tipo text not null default 'coletivo'
    check (tipo in ('coletivo', 'restrito')),
  publico_alvo text not null default 'corrente'
    check (publico_alvo in ('corrente', 'cargo', 'individual')),
  cargos_alvo text[] not null default '{}',
  fundamento_id uuid references public.fundamentos_acervo(id) on delete set null,
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'ativo', 'encerrado', 'cancelado')),
  ativado_em timestamptz,
  encerrado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim_em > inicio_em),
  check (
    (publico_alvo = 'cargo' and cardinality(cargos_alvo) > 0)
    or publico_alvo <> 'cargo'
  )
);

create table if not exists public.preceito_participantes (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.preceito_ciclos(id) on delete cascade,
  tenant_id uuid not null,
  filho_id uuid not null references public.filhos_de_santo(id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'ciente', 'dispensado', 'orientacao_solicitada')),
  confirmado_em timestamptz,
  orientacao_solicitada_em timestamptz,
  dispensado_em timestamptz,
  dispensado_por uuid,
  motivo_dispensa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ciclo_id, filho_id)
);

create index if not exists preceito_ciclos_tenant_status_idx
  on public.preceito_ciclos (tenant_id, status, inicio_em desc);
create index if not exists preceito_participantes_ciclo_status_idx
  on public.preceito_participantes (ciclo_id, status);
create index if not exists preceito_participantes_filho_idx
  on public.preceito_participantes (filho_id, tenant_id, created_at desc);

create or replace function public.touch_preceito_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists preceito_ciclos_touch_updated_at on public.preceito_ciclos;
create trigger preceito_ciclos_touch_updated_at
before update on public.preceito_ciclos
for each row execute function public.touch_preceito_updated_at();

drop trigger if exists preceito_participantes_touch_updated_at on public.preceito_participantes;
create trigger preceito_participantes_touch_updated_at
before update on public.preceito_participantes
for each row execute function public.touch_preceito_updated_at();

alter table public.preceito_ciclos enable row level security;
alter table public.preceito_participantes enable row level security;

-- Conteudo liturgico nao e liberado diretamente ao filho via PostgREST.
-- A API valida o participante materializado antes de entregar as orientacoes.
create policy "preceito ciclos zeladoria select"
  on public.preceito_ciclos for select to authenticated
  using (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  );
create policy "preceito ciclos zeladoria insert"
  on public.preceito_ciclos for insert to authenticated
  with check (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  );
create policy "preceito ciclos zeladoria update"
  on public.preceito_ciclos for update to authenticated
  using (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  )
  with check (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  );
create policy "preceito ciclos zeladoria delete"
  on public.preceito_ciclos for delete to authenticated
  using (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  );

create policy "preceito participantes zeladoria"
  on public.preceito_participantes for all to authenticated
  using (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  )
  with check (
    tenant_id in (select public.auth_lider_tenant_ids())
    or (select public.auth_is_global_admin())
  );

revoke all on public.preceito_ciclos from anon;
revoke all on public.preceito_participantes from anon;
grant select, insert, update, delete on public.preceito_ciclos to authenticated;
grant select, insert, update, delete on public.preceito_participantes to authenticated;

