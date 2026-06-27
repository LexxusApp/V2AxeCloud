-- Terreiros descobertos via Google Maps (scraping / prospecção)
-- Acesso via service role (script scripts/scrape-terreiros-google-maps.mjs)

create table if not exists public.terreiros_maps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  endereco text,
  telefone text,
  link_maps text not null,
  cidade text not null,
  estado text,
  constraint terreiros_maps_link_maps_unique unique (link_maps)
);

create index if not exists terreiros_maps_cidade_estado_idx
  on public.terreiros_maps (cidade, estado);

create index if not exists terreiros_maps_created_at_idx
  on public.terreiros_maps (created_at desc);

comment on table public.terreiros_maps is 'Cadastro público de terreiros coletado do Google Maps (prospecção AxéCloud)';
comment on column public.terreiros_maps.link_maps is 'URL canônica do place no Google Maps — chave de deduplicação';

alter table public.terreiros_maps enable row level security;
