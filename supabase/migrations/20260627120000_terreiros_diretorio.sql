-- Diretório público SEO (Google Maps) — renomeia terreiros_maps e adiciona slugs

alter table if exists public.terreiros_maps rename to terreiros_diretorio;

alter table public.terreiros_diretorio
  add column if not exists slug text,
  add column if not exists cidade_slug text;

create index if not exists terreiros_diretorio_slug_idx
  on public.terreiros_diretorio (slug)
  where slug is not null;

create index if not exists terreiros_diretorio_cidade_estado_slug_idx
  on public.terreiros_diretorio (lower(estado), cidade_slug);

comment on table public.terreiros_diretorio is 'Diretório público de terreiros (Google Maps) — páginas SEO /terreiros/:uf/:cidade e /terreiro/:slug';

-- Índice único parcial (permite null antes do backfill de slugs)
create unique index if not exists terreiros_diretorio_slug_unique_idx
  on public.terreiros_diretorio (slug)
  where slug is not null;
