-- Frequência, QR check-in, vagas, senhas de gira e mapa de velas

alter table public.calendario_axe
  add column if not exists vagas_maximas int,
  add column if not exists confirmacao_automatica boolean not null default true,
  add column if not exists senhas_ativas boolean not null default false,
  add column if not exists checkin_qr_token text,
  add column if not exists senhas_public_token text;

create unique index if not exists calendario_axe_checkin_qr_token_uidx
  on public.calendario_axe (checkin_qr_token)
  where checkin_qr_token is not null;

create unique index if not exists calendario_axe_senhas_public_token_uidx
  on public.calendario_axe (senhas_public_token)
  where senhas_public_token is not null;

-- Participação de filhos de santo (frequência + confirmação de vagas + check-in)
create table if not exists public.evento_participantes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.calendario_axe(id) on delete cascade,
  filho_id uuid not null references public.filhos_de_santo(id) on delete cascade,
  tenant_id uuid not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'recusado', 'presente')),
  checkin_token text,
  responded_at timestamptz,
  checked_in_at timestamptz,
  justificativa text,
  unique (event_id, filho_id)
);

create unique index if not exists evento_participantes_checkin_token_uidx
  on public.evento_participantes (checkin_token)
  where checkin_token is not null;

create index if not exists evento_participantes_event_idx
  on public.evento_participantes (event_id);

create index if not exists evento_participantes_filho_idx
  on public.evento_participantes (filho_id);

create index if not exists evento_participantes_tenant_idx
  on public.evento_participantes (tenant_id);

-- Senhas / tickets para consulentes em giras
create table if not exists public.evento_senhas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references public.calendario_axe(id) on delete cascade,
  tenant_id uuid not null,
  numero int not null,
  nome text not null,
  telefone text,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'chamado', 'atendido', 'cancelado')),
  called_at timestamptz,
  attended_at timestamptz,
  unique (event_id, numero)
);

create index if not exists evento_senhas_event_idx
  on public.evento_senhas (event_id);

create index if not exists evento_senhas_tenant_idx
  on public.evento_senhas (tenant_id);

-- Mapa de velas por médium/filho por gira
create table if not exists public.gira_velas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references public.calendario_axe(id) on delete cascade,
  tenant_id uuid not null,
  filho_id uuid not null references public.filhos_de_santo(id) on delete cascade,
  vela text not null default 'Branca'
    check (vela in ('Branca', 'Vermelha', 'Azul', 'Verde', 'Amarela', 'Preta', 'Nenhuma')),
  quantidade int not null default 1 check (quantidade > 0),
  entregue boolean not null default false,
  observacao text,
  unique (event_id, filho_id)
);

create index if not exists gira_velas_event_idx on public.gira_velas (event_id);
create index if not exists gira_velas_tenant_idx on public.gira_velas (tenant_id);

-- RLS
alter table public.evento_participantes enable row level security;
alter table public.evento_senhas enable row level security;
alter table public.gira_velas enable row level security;

drop policy if exists "evento_participantes tenant access" on public.evento_participantes;
create policy "evento_participantes tenant access"
  on public.evento_participantes for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

drop policy if exists "evento_senhas tenant access" on public.evento_senhas;
create policy "evento_senhas tenant access"
  on public.evento_senhas for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

drop policy if exists "gira_velas tenant access" on public.gira_velas;
create policy "gira_velas tenant access"
  on public.gira_velas for all to authenticated
  using (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin())
  with check (tenant_id in (select auth_user_tenant_ids()) or auth_is_global_admin());

notify pgrst, 'reload schema';
