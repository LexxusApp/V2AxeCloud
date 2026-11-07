begin;

-- =========================================================================
-- PILOTO ISOLADO: CO-ADMINISTRADORES / RESPONSÁVEIS PELO SISTEMA
-- EXCLUSIVO PARA O TERREIRO: vendasmercadolivrev1@gmail.com
-- ID DO TENANT: fad75b91-d2eb-4805-b5a3-c19e8a073bed
-- =========================================================================

create table if not exists public.piloto_coadministradores (
  tenant_id uuid not null check (tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid),
  filho_id uuid not null references public.filhos_de_santo(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  cargo_delegado text not null default 'Co-Administrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, filho_id)
);

alter table public.piloto_coadministradores enable row level security;
revoke all on public.piloto_coadministradores from public, anon, authenticated;
grant select on public.piloto_coadministradores to authenticated;

-- Leitura: o titular da casa OU o próprio membro delegado
drop policy if exists pilot_coadmin_owner_read on public.piloto_coadministradores;
create policy pilot_coadmin_owner_read on public.piloto_coadministradores for select to authenticated
  using (
    (tenant_id = auth.uid() and auth.uid() = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid)
    or (user_id = auth.uid() and tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid)
  );

-- Helper para checar co-administração do piloto
create or replace function public.piloto_is_coadministrador(p_tenant uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_tenant = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
    and exists (
      select 1 from public.piloto_coadministradores c
      where c.tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
        and c.user_id = p_user
        and c.ativo = true
    );
$$;
revoke all on function public.piloto_is_coadministrador(uuid, uuid) from public, anon;
grant execute on function public.piloto_is_coadministrador(uuid, uuid) to authenticated, service_role;

-- Atualizar axecloud_private.auth_lider_tenant_ids para incluir o co-admin no piloto
create or replace function axecloud_private.auth_lider_tenant_ids()
returns setof uuid language sql stable security definer set search_path = public, axecloud_private, pg_temp as $$
  select coalesce(p.tenant_id, p.id)
  from public.perfil_lider p
  where p.id = (select auth.uid())
  union
  select c.tenant_id
  from public.piloto_coadministradores c
  where c.user_id = (select auth.uid())
    and c.ativo = true
    and c.tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid;
$$;
grant execute on function axecloud_private.auth_lider_tenant_ids() to authenticated, service_role;

-- Atualizar piloto_zelador_ativo para aceitar co-administrador de vendasmercadolivrev1@gmail.com
create or replace function public.piloto_zelador_ativo(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select (
    p_tenant is not null and auth.uid() = p_tenant and exists (
      select 1 from public.perfil_lider p
      where p.id = auth.uid()
        and coalesce(nullif(to_jsonb(p)->>'tenant_id',''), p.id::text) = p_tenant::text
        and lower(coalesce(nullif(to_jsonb(p)->>'role',''),'')) in ('admin','zelador','lider','leader')
        and lower(coalesce(to_jsonb(p)->>'status','')) not in ('blocked','deleted')
        and coalesce((to_jsonb(p)->>'is_blocked')::boolean, false) = false
        and nullif(to_jsonb(p)->>'deleted_at','') is null
        and not exists (
          select 1 from public.subscriptions s where s.id = auth.uid()
            and (lower(coalesce(to_jsonb(s)->>'status','')) in ('blocked','deleted')
              or lower(coalesce(to_jsonb(s)->>'role','')) = 'filho')
        )
    )
  ) or (
    p_tenant = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid and exists (
      select 1 from public.piloto_coadministradores c
      where c.tenant_id = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
        and c.user_id = auth.uid()
        and c.ativo = true
    )
  );
$$;
revoke all on function public.piloto_zelador_ativo(uuid) from public, anon;
grant execute on function public.piloto_zelador_ativo(uuid) to authenticated, service_role;

-- RPC para o Zelador definir/revogar Co-Administrador
create or replace function public.piloto_definir_coadministrador(
  p_tenant uuid,
  p_filho_id uuid,
  p_ativo boolean
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid;
  v_filho record;
begin
  if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then
    raise exception 'Terreiro não autorizado no piloto' using errcode = '42501';
  end if;

  if auth.uid() is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then
    raise exception 'Apenas o Zelador titular pode delegar acesso de administração' using errcode = '42501';
  end if;

  select id, user_id, nome, email into v_filho
  from public.filhos_de_santo
  where id = p_filho_id and tenant_id = p_tenant;

  if not found then
    raise exception 'Filho de santo não encontrado nesta casa' using errcode = '22023';
  end if;

  v_user_id := v_filho.user_id;

  -- Se ainda não tem user_id vinculado na linha de filhos_de_santo, tenta achar pelo email
  if v_user_id is null and v_filho.email is not null and btrim(v_filho.email) <> '' then
    select id into v_user_id from auth.users where lower(email) = lower(v_filho.email) limit 1;
  end if;

  insert into public.piloto_coadministradores (tenant_id, filho_id, user_id, ativo, cargo_delegado, updated_at)
  values (p_tenant, p_filho_id, v_user_id, p_ativo, 'Co-Administrador', now())
  on conflict (tenant_id, filho_id) do update set
    ativo = excluded.ativo,
    user_id = coalesce(excluded.user_id, public.piloto_coadministradores.user_id),
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'filho_id', p_filho_id,
    'nome', v_filho.nome,
    'ativo', p_ativo,
    'user_id', v_user_id
  );
end;
$$;
revoke all on function public.piloto_definir_coadministrador(uuid, uuid, boolean) from public, anon;
grant execute on function public.piloto_definir_coadministrador(uuid, uuid, boolean) to authenticated, service_role;

-- RPC para listar os Co-Administradores do terreiro de teste
create or replace function public.piloto_listar_coadministradores(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_res jsonb;
begin
  if p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid then
    raise exception 'Terreiro não autorizado no piloto' using errcode = '42501';
  end if;

  if not (auth.uid() = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid or public.piloto_is_coadministrador(p_tenant, auth.uid())) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'filho_id', c.filho_id,
      'user_id', c.user_id,
      'nome', f.nome,
      'email', f.email,
      'cargo', f.cargo,
      'ativo', c.ativo,
      'cargo_delegado', c.cargo_delegado,
      'updated_at', c.updated_at
    ) order by c.updated_at desc
  ), '[]'::jsonb)
  into v_res
  from public.piloto_coadministradores c
  join public.filhos_de_santo f on f.id = c.filho_id
  where c.tenant_id = p_tenant;

  return jsonb_build_object('data', v_res);
end;
$$;
revoke all on function public.piloto_listar_coadministradores(uuid) from public, anon;
grant execute on function public.piloto_listar_coadministradores(uuid) to authenticated, service_role;

commit;
