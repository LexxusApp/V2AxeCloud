alter table public.growth_prospects
  add column if not exists directory_id uuid,
  add column if not exists public_email text,
  add column if not exists website_url text,
  add column if not exists contact_form_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists research_status text not null default 'pending',
  add column if not exists research_sources jsonb not null default '[]'::jsonb,
  add column if not exists outreach_channel text,
  add column if not exists outreach_status text not null default 'pending',
  add column if not exists outreach_subject text,
  add column if not exists outreach_message text,
  add column if not exists outreach_sent_at timestamptz,
  add column if not exists outreach_external_id text,
  add column if not exists selected_date date,
  add column if not exists selected_slot text,
  add column if not exists ai_sales_enabled boolean not null default true,
  add column if not exists ai_sales_stage text not null default 'novo',
  add column if not exists ai_last_reply_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'growth_prospects_research_status_check'
  ) then
    alter table public.growth_prospects add constraint growth_prospects_research_status_check
      check (research_status in ('pending','found','not_found','failed'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'growth_prospects_outreach_channel_check'
  ) then
    alter table public.growth_prospects add constraint growth_prospects_outreach_channel_check
      check (outreach_channel is null or outreach_channel in ('email','contact_form','none'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'growth_prospects_outreach_status_check'
  ) then
    alter table public.growth_prospects add constraint growth_prospects_outreach_status_check
      check (outreach_status in ('pending','sent','manual_required','failed','replied','opted_out'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'growth_prospects_selected_slot_check'
  ) then
    alter table public.growth_prospects add constraint growth_prospects_selected_slot_check
      check (selected_slot is null or selected_slot in ('morning','afternoon'));
  end if;
end $$;

create unique index if not exists growth_prospects_directory_uidx
  on public.growth_prospects (directory_id)
  where directory_id is not null;

create unique index if not exists growth_prospects_daily_slot_uidx
  on public.growth_prospects (selected_date, selected_slot)
  where selected_date is not null and selected_slot is not null;

create index if not exists growth_prospects_safe_outreach_idx
  on public.growth_prospects (outreach_status, selected_date desc, created_at desc);

comment on column public.growth_prospects.public_email is
  'E-mail comercial publicado pela própria organização, localizado durante pesquisa web.';
comment on column public.growth_prospects.selected_slot is
  'Uma das duas seleções diárias do funil seguro: morning ou afternoon.';
comment on column public.growth_prospects.ai_sales_enabled is
  'Autoriza o agente comercial a responder somente após mensagem inbound do próprio contato.';

notify pgrst, 'reload schema';
