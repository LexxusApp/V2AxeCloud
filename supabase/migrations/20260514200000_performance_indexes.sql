-- =====================================================================
-- Performance Indexes (Fase 1 do plano de otimizacao)
--
-- Cria indexes em tabelas com leituras pesadas que hoje fazem Seq Scan
-- em queries comuns do AxeCloud. Cada CREATE INDEX e idempotente
-- (IF NOT EXISTS) e protegido por checagens de existencia de tabela e
-- coluna - a migration pode rodar em qualquer ambiente sem quebrar.
--
-- ATENCAO: nao usamos CONCURRENTLY porque o Supabase SQL Editor envolve
-- comandos em transacao. Para tabelas grandes (>100k linhas) pode haver
-- um lock breve de escrita. Em tabelas com poucos milhares de linhas
-- (caso atual do AxeCloud) o impacto e imperceptivel (<1s).
--
-- Verificar resultado:
--   select schemaname, tablename, indexname from pg_indexes
--   where schemaname = 'public' order by tablename, indexname;
-- =====================================================================

do $perf$
declare
  has_col boolean;
begin
  ------------------------------------------------------------------
  -- perfil_lider
  ------------------------------------------------------------------
  if to_regclass('public.perfil_lider') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='perfil_lider' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists perfil_lider_tenant_id_idx on public.perfil_lider (tenant_id)';
      execute 'create index if not exists perfil_lider_id_tenant_idx on public.perfil_lider (id, tenant_id)';
    end if;
  end if;

  ------------------------------------------------------------------
  -- filhos_de_santo
  ------------------------------------------------------------------
  if to_regclass('public.filhos_de_santo') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='filhos_de_santo' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists filhos_de_santo_tenant_id_idx on public.filhos_de_santo (tenant_id)';
    end if;

    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='filhos_de_santo' and column_name='lider_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists filhos_de_santo_lider_id_idx on public.filhos_de_santo (lider_id)';
    end if;

    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='filhos_de_santo' and column_name='user_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists filhos_de_santo_user_id_idx on public.filhos_de_santo (user_id)';
    end if;

    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='filhos_de_santo' and column_name='email'
    ) into has_col;
    if has_col then
      -- index lower(email) ajuda fallback case-insensitive em login de filho
      execute 'create index if not exists filhos_de_santo_email_idx on public.filhos_de_santo (lower(email))';
    end if;
  end if;

  ------------------------------------------------------------------
  -- financeiro (composto cobre o caso mais comum: tenant + ordenacao por data)
  ------------------------------------------------------------------
  if to_regclass('public.financeiro') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='financeiro' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='financeiro' and column_name='data'
      ) into has_col;
      if has_col then
        execute 'create index if not exists financeiro_tenant_data_idx on public.financeiro (tenant_id, data desc)';
      end if;

      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='financeiro' and column_name='status'
      ) into has_col;
      if has_col then
        execute 'create index if not exists financeiro_tenant_status_idx on public.financeiro (tenant_id, status)';
      end if;

      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='financeiro' and column_name='filho_id'
      ) into has_col;
      if has_col then
        execute 'create index if not exists financeiro_tenant_filho_idx on public.financeiro (tenant_id, filho_id)';
      end if;
    end if;
  end if;

  ------------------------------------------------------------------
  -- mural_avisos
  ------------------------------------------------------------------
  if to_regclass('public.mural_avisos') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='mural_avisos' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='mural_avisos' and column_name='created_at'
      ) into has_col;
      if has_col then
        execute 'create index if not exists mural_avisos_tenant_created_idx on public.mural_avisos (tenant_id, created_at desc)';
      else
        execute 'create index if not exists mural_avisos_tenant_idx on public.mural_avisos (tenant_id)';
      end if;
    end if;
  end if;

  ------------------------------------------------------------------
  -- calendario_axe
  ------------------------------------------------------------------
  if to_regclass('public.calendario_axe') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='calendario_axe' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='calendario_axe' and column_name='data'
      ) into has_col;
      if has_col then
        execute 'create index if not exists calendario_axe_tenant_data_idx on public.calendario_axe (tenant_id, data desc)';
      end if;

      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='calendario_axe' and column_name='tipo'
      ) into has_col;
      if has_col then
        execute 'create index if not exists calendario_axe_tenant_tipo_idx on public.calendario_axe (tenant_id, tipo)';
      end if;
    end if;
  end if;

  ------------------------------------------------------------------
  -- subscriptions
  ------------------------------------------------------------------
  if to_regclass('public.subscriptions') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='user_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id)';
    end if;

    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='subscriptions' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists subscriptions_tenant_id_idx on public.subscriptions (tenant_id)';
    end if;
  end if;

  ------------------------------------------------------------------
  -- notifications_history (se existir)
  ------------------------------------------------------------------
  if to_regclass('public.notifications_history') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='notifications_history' and column_name='user_id'
    ) into has_col;
    if has_col then
      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='notifications_history' and column_name='created_at'
      ) into has_col;
      if has_col then
        execute 'create index if not exists notifications_history_user_created_idx on public.notifications_history (user_id, created_at desc)';
      else
        execute 'create index if not exists notifications_history_user_idx on public.notifications_history (user_id)';
      end if;
    end if;
  end if;

  ------------------------------------------------------------------
  -- inventario (tabela usada em Inventory.tsx, se existir)
  ------------------------------------------------------------------
  if to_regclass('public.inventario') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='inventario' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists inventario_tenant_id_idx on public.inventario (tenant_id)';
    end if;
  end if;

  ------------------------------------------------------------------
  -- biblioteca_estudo (tabela usada em Library.tsx, se existir)
  ------------------------------------------------------------------
  if to_regclass('public.biblioteca_estudo') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='biblioteca_estudo' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists biblioteca_estudo_tenant_id_idx on public.biblioteca_estudo (tenant_id)';
    end if;
  end if;

  ------------------------------------------------------------------
  -- loja_produtos / loja_pedidos (Store.tsx, se existirem)
  ------------------------------------------------------------------
  if to_regclass('public.loja_produtos') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='loja_produtos' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      execute 'create index if not exists loja_produtos_tenant_id_idx on public.loja_produtos (tenant_id)';
    end if;
  end if;

  if to_regclass('public.loja_pedidos') is not null then
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='loja_pedidos' and column_name='tenant_id'
    ) into has_col;
    if has_col then
      select exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='loja_pedidos' and column_name='created_at'
      ) into has_col;
      if has_col then
        execute 'create index if not exists loja_pedidos_tenant_created_idx on public.loja_pedidos (tenant_id, created_at desc)';
      else
        execute 'create index if not exists loja_pedidos_tenant_idx on public.loja_pedidos (tenant_id)';
      end if;
    end if;
  end if;
end
$perf$;

-- Atualiza planner com estatisticas frescas das tabelas mais lidas.
-- ANALYZE e barato e ajuda o postgres a escolher os indexes recem criados.
do $analyze$
begin
  if to_regclass('public.perfil_lider')         is not null then execute 'analyze public.perfil_lider'; end if;
  if to_regclass('public.filhos_de_santo')      is not null then execute 'analyze public.filhos_de_santo'; end if;
  if to_regclass('public.financeiro')           is not null then execute 'analyze public.financeiro'; end if;
  if to_regclass('public.mural_avisos')         is not null then execute 'analyze public.mural_avisos'; end if;
  if to_regclass('public.calendario_axe')       is not null then execute 'analyze public.calendario_axe'; end if;
  if to_regclass('public.subscriptions')        is not null then execute 'analyze public.subscriptions'; end if;
end
$analyze$;

-- Pede ao PostgREST para recarregar o schema (RLS + colunas).
notify pgrst, 'reload schema';
