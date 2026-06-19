-- Visitantes únicos diários do site público (landing, portal, cadastro, etc.).
-- Um registro por visitante_id por dia (deduplicado no backend).

create table if not exists public.public_site_visitors (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  visitor_id text not null,
  entry_path text not null default '/',
  referrer text,
  country text,
  city text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint public_site_visitors_visitor_day unique (visit_date, visitor_id)
);

create index if not exists idx_public_site_visitors_visit_date
  on public.public_site_visitors (visit_date desc);

alter table public.public_site_visitors enable row level security;
