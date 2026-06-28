-- Bairro/distrito para agrupamento na página da cidade (ex.: São Paulo capital)

alter table public.terreiros_diretorio
  add column if not exists bairro text,
  add column if not exists bairro_slug text;

create index if not exists terreiros_diretorio_cidade_bairro_idx
  on public.terreiros_diretorio (lower(estado), cidade_slug, bairro_slug)
  where bairro_slug is not null;

comment on column public.terreiros_diretorio.bairro is 'Bairro/distrito para agrupamento na listagem da cidade (ex. Itaim Paulista em São Paulo)';
