-- Lembrete automático WhatsApp por gira/evento (opt-in, intervalo em dias).
alter table public.calendario_axe
  add column if not exists wa_reminder_interval_days smallint;

alter table public.calendario_axe
  drop constraint if exists calendario_axe_wa_reminder_interval_days_check;

alter table public.calendario_axe
  add constraint calendario_axe_wa_reminder_interval_days_check
  check (
    wa_reminder_interval_days is null
    or (wa_reminder_interval_days >= 1 and wa_reminder_interval_days <= 7)
  );

comment on column public.calendario_axe.wa_reminder_interval_days is
  'Intervalo em dias para lembrete WhatsApp (aviso_gira). Null = desligado. Envia a cada N dias e no dia do evento.';
