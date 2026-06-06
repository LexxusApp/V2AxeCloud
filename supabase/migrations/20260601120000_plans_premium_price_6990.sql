-- Premium comercial: R$ 69,90 (catálogo global usado no checkout EFI / Pix).
update public.global_settings
set
  data = jsonb_strip_nulls(
    coalesce(data, '{}'::jsonb)
    || jsonb_build_object(
      'premium', coalesce(data->'premium', '{}'::jsonb)
        || jsonb_build_object(
          'name', coalesce(data->'premium'->>'name', 'Premium'),
          'price', 69.90,
          'price_cents', 6990,
          'description', coalesce(
            data->'premium'->>'description',
            'Gestão espiritual e financeira completa para o seu terreiro. Plano renovável.'
          )
        )
    )
  ),
  updated_at = now()
where id = 'plans';

insert into public.global_settings (id, data, updated_at)
select
  'plans',
  jsonb_build_object(
    'premium', jsonb_build_object(
      'name', 'Premium',
      'price', 69.90,
      'price_cents', 6990,
      'description', 'Gestão espiritual e financeira completa para o seu terreiro. Plano renovável.'
    ),
    'vita', jsonb_build_object(
      'name', 'Plano Vita',
      'price', 49.90,
      'description', 'Vitalício — acesso completo sem expiração.'
    )
  ),
  now()
where not exists (select 1 from public.global_settings where id = 'plans');
