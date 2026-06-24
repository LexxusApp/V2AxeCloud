-- Chat interno da corrente: conversas, participantes e mensagens

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  type text not null default 'direct',
  title text,
  direct_key text,
  created_by uuid not null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_conversations_type_check check (type in ('direct', 'group')),
  constraint chat_conversations_direct_key_check check (
    (type = 'group' and direct_key is null)
    or (type = 'direct' and direct_key is not null and btrim(direct_key) <> '')
  )
);

create unique index if not exists chat_conversations_tenant_direct_key_uidx
  on public.chat_conversations (tenant_id, direct_key)
  where type = 'direct' and direct_key is not null;

create index if not exists chat_conversations_tenant_last_msg_idx
  on public.chat_conversations (tenant_id, last_message_at desc nulls last);

create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  tenant_id uuid not null,
  participant_type text not null,
  filho_id uuid references public.filhos_de_santo (id) on delete set null,
  user_id uuid not null,
  last_read_at timestamptz,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  constraint chat_participants_type_check check (participant_type in ('filho', 'admin')),
  constraint chat_participants_user_uniq unique (conversation_id, user_id)
);

create index if not exists chat_participants_user_idx
  on public.chat_participants (user_id, tenant_id);

create index if not exists chat_participants_conversation_idx
  on public.chat_participants (conversation_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  tenant_id uuid not null,
  sender_user_id uuid not null,
  sender_filho_id uuid references public.filhos_de_santo (id) on delete set null,
  body text,
  message_type text not null default 'text',
  media_url text,
  media_path text,
  media_mime text,
  media_size_bytes bigint,
  media_duration_sec int,
  reply_to_id uuid references public.chat_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_messages_type_check check (
    message_type in ('text', 'image', 'video', 'audio', 'system')
  )
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at asc);

create index if not exists chat_messages_tenant_created_idx
  on public.chat_messages (tenant_id, created_at desc);

-- Conversas em que o usuário autenticado participa
create or replace function public.auth_user_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct cp.conversation_id
  from public.chat_participants cp
  where cp.user_id = (select auth.uid());
$$;

revoke all on function public.auth_user_conversation_ids() from public;
grant execute on function public.auth_user_conversation_ids() to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

-- chat_conversations
drop policy if exists "chat_conversations_select" on public.chat_conversations;
create policy "chat_conversations_select"
  on public.chat_conversations for select to authenticated
  using (
    id in (select auth_user_conversation_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "chat_conversations_insert" on public.chat_conversations;
create policy "chat_conversations_insert"
  on public.chat_conversations for insert to authenticated
  with check (
    tenant_id in (select auth_user_tenant_ids())
    and created_by = (select auth.uid())
    or (select auth_is_global_admin())
  );

drop policy if exists "chat_conversations_update" on public.chat_conversations;
create policy "chat_conversations_update"
  on public.chat_conversations for update to authenticated
  using (
    id in (select auth_user_conversation_ids())
    or tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

-- chat_participants
drop policy if exists "chat_participants_select" on public.chat_participants;
create policy "chat_participants_select"
  on public.chat_participants for select to authenticated
  using (
    conversation_id in (select auth_user_conversation_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "chat_participants_insert" on public.chat_participants;
create policy "chat_participants_insert"
  on public.chat_participants for insert to authenticated
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "chat_participants_update_own" on public.chat_participants;
create policy "chat_participants_update_own"
  on public.chat_participants for update to authenticated
  using (user_id = (select auth.uid()) or (select auth_is_global_admin()))
  with check (user_id = (select auth.uid()) or (select auth_is_global_admin()));

-- chat_messages
drop policy if exists "chat_messages_select" on public.chat_messages;
create policy "chat_messages_select"
  on public.chat_messages for select to authenticated
  using (
    conversation_id in (select auth_user_conversation_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert"
  on public.chat_messages for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and conversation_id in (select auth_user_conversation_ids())
    and tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own"
  on public.chat_messages for update to authenticated
  using (
    sender_user_id = (select auth.uid())
    or tenant_id in (select auth_lider_tenant_ids())
    or (select auth_is_global_admin())
  )
  with check (
    tenant_id in (select auth_user_tenant_ids())
    or (select auth_is_global_admin())
  );

-- Realtime
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_conversations;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_participants;
exception
  when duplicate_object then null;
end $$;
