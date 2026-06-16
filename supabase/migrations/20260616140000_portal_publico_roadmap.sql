-- Portal público AxéCloud (roadmap T1–T6): diretório, eventos, confiança, analytics

alter table public.perfil_lider
  add column if not exists portal_publico_ativo boolean not null default false,
  add column if not exists cidade_publica text,
  add column if not exists estado_publico text,
  add column if not exists bairro_publico text,
  add column if not exists whatsapp_publico text,
  add column if not exists descricao_publica text,
  add column if not exists casa_verificada boolean not null default false,
  add column if not exists portal_destaque boolean not null default false;

alter table public.calendario_axe
  add column if not exists evento_publico boolean not null default false;

create index if not exists calendario_axe_publico_data_idx
  on public.calendario_axe (evento_publico, data)
  where evento_publico = true;

create index if not exists perfil_lider_portal_publico_idx
  on public.perfil_lider (portal_publico_ativo, lower(public_slug))
  where portal_publico_ativo = true and deleted_at is null;

-- Visualizações de perfil (T5 analytics)
create table if not exists public.portal_profile_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  leader_id uuid not null references public.perfil_lider(id) on delete cascade,
  ip_hash text
);

create index if not exists portal_profile_views_leader_created_idx
  on public.portal_profile_views (leader_id, created_at desc);

alter table public.portal_profile_views enable row level security;

-- Denúncias (T3 moderação)
create table if not exists public.portal_denuncias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  leader_id uuid references public.perfil_lider(id) on delete set null,
  motivo text not null,
  detalhe text,
  email_contacto text,
  status text not null default 'pendente',
  constraint portal_denuncias_status_check
    check (status in ('pendente', 'analisada', 'arquivada'))
);

create index if not exists portal_denuncias_status_created_idx
  on public.portal_denuncias (status, created_at desc);

alter table public.portal_denuncias enable row level security;

-- Newsletter agenda da semana (T2)
create table if not exists public.portal_newsletter (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  cidade text,
  estado text,
  constraint portal_newsletter_email_unique unique (email)
);

alter table public.portal_newsletter enable row level security;

-- Casas fundadoras aceitas com opt-in → perfil público + verificada
update public.perfil_lider pl
set
  portal_publico_ativo = true,
  casa_verificada = true
from public.founder_applications fa
where fa.leader_id = pl.id
  and fa.status = 'accepted'
  and fa.autoriza_perfil_publico = true
  and coalesce(pl.portal_publico_ativo, false) = false;

update public.perfil_lider pl
set
  cidade_publica = coalesce(nullif(btrim(pl.cidade_publica), ''), fa.cidade),
  estado_publico = coalesce(nullif(btrim(pl.estado_publico), ''), fa.estado)
from public.founder_applications fa
where fa.leader_id = pl.id
  and fa.status = 'accepted';
