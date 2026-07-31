-- Acervo liturgico controlado: banhos, ervas, rituais e outros fundamentos.
-- O conteudo e entregue somente pela API, depois da verificacao de funcao,
-- tradicao, vinculo individual e status do membro.

-- Alguns ambientes antigos registraram a migration de seguranca sem manter estes
-- helpers. Recriacao idempotente para que as policies sejam portaveis.
create or replace function public.auth_lider_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.tenant_id, p.id)
  from public.perfil_lider p
  where p.id = (select auth.uid())
    and lower(coalesce(p.role, 'admin')) <> 'filho'
    and not exists (
      select 1 from public.filhos_de_santo f
      where f.user_id = (select auth.uid())
    );
$$;

create or replace function public.auth_is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin_global from public.perfil_lider where id = (select auth.uid())),
    false
  );
$$;

create table if not exists public.fundamentos_acervo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  autor_id uuid not null,
  titulo text not null check (char_length(trim(titulo)) between 3 and 140),
  resumo text,
  conteudo text not null check (char_length(trim(conteudo)) between 3 and 50000),
  categoria text not null default 'fundamentos'
    check (categoria in ('banhos', 'ervas', 'rituais', 'defumacoes', 'firmezas', 'fundamentos', 'outros')),
  tradicao text not null default 'todas',
  nivel_acesso text not null default 'corrente'
    check (nivel_acesso in ('corrente', 'cargo', 'individual', 'zeladoria')),
  cargos_permitidos text[] not null default '{}',
  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicado', 'arquivado')),
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fundamentos_acessos (
  id uuid primary key default gen_random_uuid(),
  fundamento_id uuid not null references public.fundamentos_acervo(id) on delete cascade,
  tenant_id uuid not null,
  filho_id uuid not null references public.filhos_de_santo(id) on delete cascade,
  concedido_por uuid not null,
  created_at timestamptz not null default now(),
  unique (fundamento_id, filho_id)
);

create table if not exists public.fundamentos_audit_logs (
  id bigint generated always as identity primary key,
  fundamento_id uuid references public.fundamentos_acervo(id) on delete set null,
  tenant_id uuid not null,
  user_id uuid not null,
  filho_id uuid references public.filhos_de_santo(id) on delete set null,
  acao text not null check (acao in ('criou', 'editou', 'publicou', 'arquivou', 'abriu')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fundamentos_acervo_tenant_status_idx
  on public.fundamentos_acervo (tenant_id, status, updated_at desc);
create index if not exists fundamentos_acervo_categoria_idx
  on public.fundamentos_acervo (tenant_id, categoria);
create index if not exists fundamentos_acessos_filho_idx
  on public.fundamentos_acessos (filho_id, tenant_id);
create index if not exists fundamentos_audit_tenant_created_idx
  on public.fundamentos_audit_logs (tenant_id, created_at desc);

create or replace function public.touch_fundamentos_acervo_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status = 'publicado' and (old.status is distinct from 'publicado' or new.publicado_em is null) then
    new.publicado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists fundamentos_acervo_touch_updated_at on public.fundamentos_acervo;
create trigger fundamentos_acervo_touch_updated_at
before update on public.fundamentos_acervo
for each row execute function public.touch_fundamentos_acervo_updated_at();

alter table public.fundamentos_acervo enable row level security;
alter table public.fundamentos_acessos enable row level security;
alter table public.fundamentos_audit_logs enable row level security;

-- Defesa em profundidade: somente zeladoria acessa as tabelas diretamente.
-- Filhos recebem apenas os itens liberados pela API, que aplica todas as regras.
create policy "fundamentos zeladoria select"
  on public.fundamentos_acervo for select to authenticated
  using (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()));
create policy "fundamentos zeladoria insert"
  on public.fundamentos_acervo for insert to authenticated
  with check (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()));
create policy "fundamentos zeladoria update"
  on public.fundamentos_acervo for update to authenticated
  using (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()))
  with check (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()));
create policy "fundamentos zeladoria delete"
  on public.fundamentos_acervo for delete to authenticated
  using (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()));

create policy "fundamentos acessos zeladoria"
  on public.fundamentos_acessos for all to authenticated
  using (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()))
  with check (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()));

create policy "fundamentos auditoria zeladoria"
  on public.fundamentos_audit_logs for select to authenticated
  using (tenant_id in (select public.auth_lider_tenant_ids()) or (select public.auth_is_global_admin()));

revoke all on public.fundamentos_acervo from anon;
revoke all on public.fundamentos_acessos from anon;
revoke all on public.fundamentos_audit_logs from anon;
grant select, insert, update, delete on public.fundamentos_acervo to authenticated;
grant select, insert, update, delete on public.fundamentos_acessos to authenticated;
grant select on public.fundamentos_audit_logs to authenticated;
