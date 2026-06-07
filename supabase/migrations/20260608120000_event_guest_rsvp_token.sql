-- RSVP público para convidados de eventos (links no WhatsApp)

alter table public.convidados_eventos
  add column if not exists rsvp_token text,
  add column if not exists rsvp_responded_at timestamptz;

create unique index if not exists convidados_eventos_rsvp_token_uidx
  on public.convidados_eventos (rsvp_token)
  where rsvp_token is not null;

update public.convidados_eventos
set rsvp_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where rsvp_token is null;

alter table public.convidados_eventos
  alter column rsvp_token set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

notify pgrst, 'reload schema';
