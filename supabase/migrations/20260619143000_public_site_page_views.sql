-- Páginas visitadas por visitante único por dia (breakdown do site público).

create table if not exists public.public_site_page_views (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  visitor_id text not null,
  path text not null,
  path_bucket text not null,
  created_at timestamptz not null default now(),
  constraint public_site_page_views_unique unique (visit_date, visitor_id, path)
);

create index if not exists idx_public_site_page_views_date_bucket
  on public.public_site_page_views (visit_date desc, path_bucket);

alter table public.public_site_page_views enable row level security;
