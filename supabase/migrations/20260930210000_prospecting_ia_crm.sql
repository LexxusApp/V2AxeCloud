-- Migration: Prospecção IA - CRM e Automação de Leads
-- AxéCloud Prospecção IA

create table if not exists public.prospecting_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  provider_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospecting_leads (
  id uuid primary key default gen_random_uuid(),
  terreiro_id uuid references public.perfil_lider(id) on delete set null,
  directory_id uuid references public.terreiros_diretorio(id) on delete set null,
  name text not null,
  city text,
  state text,
  address text,
  phone text,
  phone_normalized text,
  email text,
  website text,
  instagram text,
  google_place_id text,
  source text not null default 'existing_axecloud_database',
  status text not null default 'discovered' check (
    status in (
      'discovered',
      'enriching',
      'analyzed',
      'qualified',
      'waiting_contact',
      'contacted',
      'replied',
      'interested',
      'demo',
      'trial',
      'customer',
      'not_interested',
      'do_not_contact',
      'duplicate',
      'invalid'
    )
  ),
  score integer not null default 0 check (score >= 0 and score <= 100),
  ai_summary text,
  last_contact_at timestamptz,
  next_action_at timestamptz,
  whatsapp_opt_in boolean not null default false,
  opt_in_source text,
  opt_in_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospecting_leads_phone_idx
  on public.prospecting_leads (phone_normalized)
  where phone_normalized is not null;

create index if not exists prospecting_leads_place_id_idx
  on public.prospecting_leads (google_place_id)
  where google_place_id is not null;

create index if not exists prospecting_leads_status_idx
  on public.prospecting_leads (status);

create index if not exists prospecting_leads_score_idx
  on public.prospecting_leads (score desc);

create index if not exists prospecting_leads_city_state_idx
  on public.prospecting_leads (city, state);

create index if not exists prospecting_leads_created_at_idx
  on public.prospecting_leads (created_at desc);

create table if not exists public.prospecting_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.prospecting_leads(id) on delete cascade,
  type text not null,
  value text not null,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists prospecting_contacts_lead_id_idx
  on public.prospecting_contacts (lead_id);

create table if not exists public.prospecting_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.prospecting_leads(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  summary text not null default '',
  business_signals jsonb not null default '[]'::jsonb,
  possible_needs jsonb not null default '[]'::jsonb,
  digital_presence jsonb not null default '{}'::jsonb,
  recommended_next_action text not null default '',
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prospecting_ai_analysis_lead_idx
  on public.prospecting_ai_analysis (lead_id, created_at desc);

create table if not exists public.prospecting_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.prospecting_leads(id) on delete cascade,
  channel text not null default 'whatsapp',
  external_conversation_id text,
  status text not null default 'open' check (status in ('open', 'waiting_reply', 'closed', 'do_not_contact')),
  last_message_at timestamptz,
  human_handoff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospecting_conversations_lead_idx
  on public.prospecting_conversations (lead_id);

create table if not exists public.prospecting_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.prospecting_conversations(id) on delete cascade,
  lead_id uuid references public.prospecting_leads(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  message_type text not null default 'text',
  external_id text unique,
  status text not null default 'sent',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prospecting_messages_conversation_idx
  on public.prospecting_messages (conversation_id, created_at desc);

create table if not exists public.prospecting_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.prospecting_leads(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prospecting_events_lead_idx
  on public.prospecting_events (lead_id, created_at desc);

create table if not exists public.prospecting_consents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.prospecting_leads(id) on delete cascade,
  channel text not null default 'whatsapp',
  granted boolean not null default true,
  source text not null,
  ip text,
  granted_at timestamptz not null default now()
);

create index if not exists prospecting_consents_lead_idx
  on public.prospecting_consents (lead_id);

create table if not exists public.prospecting_blacklist (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  reason text not null,
  source text not null default 'opt_out',
  created_at timestamptz not null default now()
);

-- Seed de fontes padrão
insert into public.prospecting_sources (code, name, provider_type, config, is_active)
values
  ('existing_axecloud_database', 'Base Interna AxéCloud', 'existing_axecloud_database', '{"description": "Terreiros catalogados no diretório do AxéCloud"}'::jsonb, true),
  ('google_places', 'Google Places API', 'google_places', '{"description": "Busca pública de terreiros e casas de axé no Google Maps"}'::jsonb, true),
  ('manual', 'Cadastro Manual', 'manual', '{"description": "Leads inseridos manualmente pela equipe comercial"}'::jsonb, true),
  ('csv', 'Importação CSV', 'csv', '{"description": "Importação em lote via planilha CSV"}'::jsonb, true)
on conflict (code) do nothing;

-- RLS
alter table public.prospecting_sources enable row level security;
alter table public.prospecting_leads enable row level security;
alter table public.prospecting_contacts enable row level security;
alter table public.prospecting_ai_analysis enable row level security;
alter table public.prospecting_conversations enable row level security;
alter table public.prospecting_messages enable row level security;
alter table public.prospecting_events enable row level security;
alter table public.prospecting_consents enable row level security;
alter table public.prospecting_blacklist enable row level security;

-- Políticas para service_role (Workers e Jobs)
create policy "service_role_prospecting_sources" on public.prospecting_sources for all to service_role using (true) with check (true);
create policy "service_role_prospecting_leads" on public.prospecting_leads for all to service_role using (true) with check (true);
create policy "service_role_prospecting_contacts" on public.prospecting_contacts for all to service_role using (true) with check (true);
create policy "service_role_prospecting_ai_analysis" on public.prospecting_ai_analysis for all to service_role using (true) with check (true);
create policy "service_role_prospecting_conversations" on public.prospecting_conversations for all to service_role using (true) with check (true);
create policy "service_role_prospecting_messages" on public.prospecting_messages for all to service_role using (true) with check (true);
create policy "service_role_prospecting_events" on public.prospecting_events for all to service_role using (true) with check (true);
create policy "service_role_prospecting_consents" on public.prospecting_consents for all to service_role using (true) with check (true);
create policy "service_role_prospecting_blacklist" on public.prospecting_blacklist for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
