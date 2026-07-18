alter table public.public_conversion_events
  drop constraint if exists public_conversion_events_event_name_check;

alter table public.public_conversion_events
  add constraint public_conversion_events_event_name_check
  check (event_name in (
    'landing_view',
    'section_view',
    'cta_click',
    'register_view',
    'register_started',
    'register_failed',
    'register_completed',
    'directory_performance'
  ));
