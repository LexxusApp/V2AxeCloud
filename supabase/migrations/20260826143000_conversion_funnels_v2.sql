-- Separa aquisição comercial, diretório e etapas reais do cadastro.
alter table public.public_conversion_events
  drop constraint if exists public_conversion_events_event_name_check;

alter table public.public_conversion_events
  add constraint public_conversion_events_event_name_check
  check (event_name in (
    'landing_view',
    'commercial_view',
    'section_view',
    'cta_click',
    'commercial_cta_click',
    'trial_cta_click',
    'login_click',
    'directory_view',
    'directory_action',
    'claim_started',
    'claim_completed',
    'register_view',
    'register_started',
    'register_step_completed',
    'register_submitted',
    'register_failed',
    'register_completed',
    'directory_performance'
  ));

create index if not exists public_conversion_events_event_created_idx
  on public.public_conversion_events (event_name, created_at desc);
