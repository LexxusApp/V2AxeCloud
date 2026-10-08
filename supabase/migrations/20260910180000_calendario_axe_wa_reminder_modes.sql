-- Lembrete de gira: modo (antes / recorrente) + janela (relativa / absoluta).
alter table public.calendario_axe
  add column if not exists wa_reminder_mode text,
  add column if not exists wa_reminder_window_kind text,
  add column if not exists wa_reminder_window_start_days smallint,
  add column if not exists wa_reminder_window_end_days smallint,
  add column if not exists wa_reminder_window_start_date date,
  add column if not exists wa_reminder_window_end_date date;
alter table public.calendario_axe drop constraint if exists calendario_axe_wa_reminder_mode_check;
alter table public.calendario_axe add constraint calendario_axe_wa_reminder_mode_check check (wa_reminder_mode is null or wa_reminder_mode in ('antes', 'recorrente'));
alter table public.calendario_axe drop constraint if exists calendario_axe_wa_reminder_window_kind_check;
alter table public.calendario_axe add constraint calendario_axe_wa_reminder_window_kind_check check (wa_reminder_window_kind is null or wa_reminder_window_kind in ('relativa', 'absoluta'));
alter table public.calendario_axe drop constraint if exists calendario_axe_wa_reminder_window_start_days_check;
alter table public.calendario_axe add constraint calendario_axe_wa_reminder_window_start_days_check check (wa_reminder_window_start_days is null or (wa_reminder_window_start_days >= 1 and wa_reminder_window_start_days <= 90));
alter table public.calendario_axe drop constraint if exists calendario_axe_wa_reminder_window_end_days_check;
alter table public.calendario_axe add constraint calendario_axe_wa_reminder_window_end_days_check check (wa_reminder_window_end_days is null or (wa_reminder_window_end_days >= 0 and wa_reminder_window_end_days <= 90));
update public.calendario_axe set wa_reminder_mode = coalesce(wa_reminder_mode, 'recorrente'), wa_reminder_window_kind = coalesce(wa_reminder_window_kind, 'relativa'), wa_reminder_window_end_days = coalesce(wa_reminder_window_end_days, 0) where wa_reminder_interval_days is not null and wa_reminder_mode is null;
comment on column public.calendario_axe.wa_reminder_mode is 'antes = só N dias antes (+ dia da gira); recorrente = a cada N dias até a gira.';
comment on column public.calendario_axe.wa_reminder_window_kind is 'relativa = janela em dias antes do evento; absoluta = datas calendário.';
