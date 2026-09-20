-- Registro mínimo e permanente de pedidos de retirada do diretório.
-- Os identificadores existem somente para impedir que raspagens futuras
-- recriem um perfil que o responsável pediu para remover.
create table if not exists public.terreiros_diretorio_removidos (
  id uuid primary key default gen_random_uuid(),
  slugs text[] not null default '{}'::text[],
  phone_digits text[] not null default '{}'::text[],
  maps_fingerprints text[] not null default '{}'::text[],
  latitude double precision,
  longitude double precision,
  motivo text not null,
  solicitado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.terreiros_diretorio_removidos enable row level security;
revoke all on table public.terreiros_diretorio_removidos from anon, authenticated;
grant select, insert, update, delete on table public.terreiros_diretorio_removidos to service_role;

comment on table public.terreiros_diretorio_removidos is
  'Identificadores mínimos de perfis removidos, usados exclusivamente para evitar republicação.';

create or replace function public._bloquear_terreiro_diretorio_removido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.terreiros_diretorio_removidos r
    where exists (
      select 1 from unnest(r.slugs) value
      where lower(value) = lower(coalesce(new.slug, ''))
    )
    or exists (
      select 1 from unnest(r.phone_digits) value
      where value <> '' and value = regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g')
    )
    or exists (
      select 1 from unnest(r.maps_fingerprints) value
      where value <> '' and position(lower(value) in lower(coalesce(new.link_maps, ''))) > 0
    )
    or (
      r.latitude is not null and r.longitude is not null and
      new.latitude is not null and new.longitude is not null and
      abs(new.latitude - r.latitude) < 0.00015 and
      abs(new.longitude - r.longitude) < 0.00015
    )
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_terreiro_diretorio_removido
  on public.terreiros_diretorio;
create trigger trg_bloquear_terreiro_diretorio_removido
before insert or update on public.terreiros_diretorio
for each row execute function public._bloquear_terreiro_diretorio_removido();

insert into public.terreiros_diretorio_removidos (
  slugs,
  phone_digits,
  maps_fingerprints,
  latitude,
  longitude,
  motivo,
  solicitado_em
)
select
  array['associacao-araxa', 'templo-de-umbanda-pai-jobim-da-guine'],
  array['556696366731', '5561991027638'],
  array['11qg34f83g', '0x9379b9f0f7d91423:0xd478f41fcc5d40d7'],
  -16.4811664,
  -54.574702,
  'Retirada solicitada pelo responsável da Associação Araxá via WhatsApp em 2026-09-20.',
  '2026-09-20T11:14:00-03:00'::timestamptz
where not exists (
  select 1
  from public.terreiros_diretorio_removidos
  where 'templo-de-umbanda-pai-jobim-da-guine' = any(slugs)
);

-- Remove métricas públicas e qualquer fila comercial vinculada ao perfil.
delete from public.access_logs
where target_type = 'directory_terreiro'
  and target_id = 'eae7776f-66c8-41ef-b3f6-b2cff9bb4488';

delete from public.growth_prospects
where terreiro_slug in ('associacao-araxa', 'templo-de-umbanda-pai-jobim-da-guine');

-- Claims e serviços possuem ON DELETE CASCADE.
delete from public.terreiros_diretorio
where id = 'eae7776f-66c8-41ef-b3f6-b2cff9bb4488'
   or slug in ('associacao-araxa', 'templo-de-umbanda-pai-jobim-da-guine');
