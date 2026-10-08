-- Lembrete por quantidade de disparos (UI simplificada).
alter table public.calendario_axe add column if not exists wa_reminder_count smallint;
alter table public.calendario_axe drop constraint if exists calendario_axe_wa_reminder_mode_check;
alter table public.calendario_axe add constraint calendario_axe_wa_reminder_mode_check check (wa_reminder_mode is null or wa_reminder_mode in ('antes', 'recorrente', 'quantidade'));
alter table public.calendario_axe drop constraint if exists calendario_axe_wa_reminder_count_check;
alter table public.calendario_axe add constraint calendario_axe_wa_reminder_count_check check (wa_reminder_count is null or (wa_reminder_count >= 1 and wa_reminder_count <= 30));
comment on column public.calendario_axe.wa_reminder_count is 'Quantidade de disparos WhatsApp espaçados entre começa/termina (modo quantidade).';
