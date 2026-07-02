-- Senhas de visitantes: limite, token público do evento, check-in na portaria

alter table public.calendario_axe
  add column if not exists senhas_maximas int check (senhas_maximas is null or senhas_maximas > 0),
  add column if not exists evento_public_token text;

create unique index if not exists calendario_axe_evento_public_token_uidx
  on public.calendario_axe (evento_public_token)
  where evento_public_token is not null;

alter table public.evento_senhas
  add column if not exists checkin_token text,
  add column if not exists checked_in_at timestamptz;

create unique index if not exists evento_senhas_checkin_token_uidx
  on public.evento_senhas (checkin_token)
  where checkin_token is not null;

create unique index if not exists evento_senhas_event_telefone_uidx
  on public.evento_senhas (event_id, telefone)
  where telefone is not null and telefone <> '';

-- Expand status to include 'presente' (portaria check-in for visitors)
alter table public.evento_senhas drop constraint if exists evento_senhas_status_check;
alter table public.evento_senhas
  add constraint evento_senhas_status_check
  check (status in ('aguardando', 'presente', 'chamado', 'atendido', 'cancelado'));
