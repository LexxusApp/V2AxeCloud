alter table public.terreiros_diretorio
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists coordinate_source text,
  add column if not exists coordinates_updated_at timestamptz;

alter table public.terreiros_diretorio
  drop constraint if exists terreiros_diretorio_latitude_valid,
  add constraint terreiros_diretorio_latitude_valid
    check (latitude is null or latitude between -90 and 90),
  drop constraint if exists terreiros_diretorio_longitude_valid,
  add constraint terreiros_diretorio_longitude_valid
    check (longitude is null or longitude between -180 and 180),
  drop constraint if exists terreiros_diretorio_coordinates_pair,
  add constraint terreiros_diretorio_coordinates_pair
    check ((latitude is null) = (longitude is null));

create index if not exists terreiros_diretorio_coordinates_idx
  on public.terreiros_diretorio (latitude, longitude)
  where latitude is not null and longitude is not null;

comment on column public.terreiros_diretorio.latitude is
  'Latitude individual confirmada a partir do link público do estabelecimento.';
comment on column public.terreiros_diretorio.longitude is
  'Longitude individual confirmada a partir do link público do estabelecimento.';
comment on column public.terreiros_diretorio.coordinate_source is
  'Origem das coordenadas; atualmente google_maps_url.';

with parsed as (
  select
    id,
    coalesce(
      (regexp_match(link_maps, '@(-?[0-9]{1,3}\.[0-9]+),(-?[0-9]{1,3}\.[0-9]+)'))[1],
      (regexp_match(link_maps, '!3d(-?[0-9]{1,3}\.[0-9]+)!4d(-?[0-9]{1,3}\.[0-9]+)'))[1]
    )::double precision as lat,
    coalesce(
      (regexp_match(link_maps, '@(-?[0-9]{1,3}\.[0-9]+),(-?[0-9]{1,3}\.[0-9]+)'))[2],
      (regexp_match(link_maps, '!3d(-?[0-9]{1,3}\.[0-9]+)!4d(-?[0-9]{1,3}\.[0-9]+)'))[2]
    )::double precision as lng
  from public.terreiros_diretorio
  where latitude is null and longitude is null
)
update public.terreiros_diretorio as t
set
  latitude = parsed.lat,
  longitude = parsed.lng,
  coordinate_source = 'google_maps_url',
  coordinates_updated_at = now()
from parsed
where t.id = parsed.id
  and parsed.lat between -90 and 90
  and parsed.lng between -180 and 180;
