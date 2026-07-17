-- Caixa de entrada WhatsApp (Meta Cloud) — visão global no admin console.
create table if not exists public.admin_whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  contact_name text,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_count int not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_whatsapp_conversations_phone_uidx
  on public.admin_whatsapp_conversations (phone_e164);

create index if not exists admin_whatsapp_conversations_last_msg_idx
  on public.admin_whatsapp_conversations (last_message_at desc);

create table if not exists public.admin_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.admin_whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null default '',
  message_type text not null default 'text',
  external_id text,
  media_url text,
  status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists admin_whatsapp_messages_external_uidx
  on public.admin_whatsapp_messages (external_id)
  where external_id is not null;

create index if not exists admin_whatsapp_messages_conv_created_idx
  on public.admin_whatsapp_messages (conversation_id, created_at asc);

alter table public.admin_whatsapp_conversations enable row level security;
alter table public.admin_whatsapp_messages enable row level security;

-- Acesso somente via service_role (API admin). Sem policies de authenticated.
comment on table public.admin_whatsapp_conversations is
  'Conversas inbound/outbound do número oficial Meta Cloud; acesso via admin-console API.';
comment on table public.admin_whatsapp_messages is
  'Mensagens da caixa WhatsApp do admin; acesso via admin-console API.';

notify pgrst, 'reload schema';
