-- Reduz a superfície exposta pela chave pública sem alterar o acesso de
-- usuários autenticados. O frontend autenticado continua operando com o papel
-- `authenticated`; rotas públicas do diretório usam o backend service_role.

-- Migrations posteriores a 20260719140610 recriaram dois helpers no schema
-- público. Primeiro, removemos as dependências restantes das policies.
alter policy "fundamentos zeladoria select"
  on public.fundamentos_acervo
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "fundamentos zeladoria insert"
  on public.fundamentos_acervo
  with check (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "fundamentos zeladoria update"
  on public.fundamentos_acervo
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  )
  with check (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "fundamentos zeladoria delete"
  on public.fundamentos_acervo
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "fundamentos acessos zeladoria"
  on public.fundamentos_acessos
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  )
  with check (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "fundamentos auditoria zeladoria"
  on public.fundamentos_audit_logs
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "preceito ciclos zeladoria select"
  on public.preceito_ciclos
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "preceito ciclos zeladoria insert"
  on public.preceito_ciclos
  with check (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "preceito ciclos zeladoria update"
  on public.preceito_ciclos
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  )
  with check (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "preceito ciclos zeladoria delete"
  on public.preceito_ciclos
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

alter policy "preceito participantes zeladoria"
  on public.preceito_participantes
  using (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  )
  with check (
    tenant_id in (select axecloud_private.auth_lider_tenant_ids())
    or (select axecloud_private.auth_is_global_admin())
  );

-- Configurações globais não são um endpoint anônimo. O backend continua com
-- acesso total via service_role e o administrador autenticado usa o helper
-- privado já empregado pelas demais policies.
drop policy if exists "Global settings access" on public.global_settings;
create policy "Global settings admin access"
  on public.global_settings for all to authenticated
  using ((select axecloud_private.auth_is_global_admin()))
  with check ((select axecloud_private.auth_is_global_admin()));

-- Retira privilégios genéricos da anon key. O único acesso direto público hoje
-- é a leitura dos atendimentos marcados como disponíveis; o diretório e os
-- demais formulários públicos passam pelas APIs do servidor.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
grant select on public.terreiro_servicos to anon;

-- Os helpers públicos não são mais necessários pelas policies. Mantemos as
-- funções por compatibilidade de migrations, mas elas deixam de ser RPCs
-- acessíveis pela API pública.
revoke all on function public.auth_lider_tenant_ids() from public, anon, authenticated;
revoke all on function public.auth_is_global_admin() from public, anon, authenticated;
grant execute on function public.auth_lider_tenant_ids() to service_role;
grant execute on function public.auth_is_global_admin() to service_role;

-- Evita resolução de objetos por search_path mutável no trigger.
alter function public.set_updated_at_terreiro_servicos()
  set search_path = public, pg_temp;
revoke all on function public.set_updated_at_terreiro_servicos() from public, anon;

-- Novos objetos não devem voltar a herdar permissões anônimas amplas.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

