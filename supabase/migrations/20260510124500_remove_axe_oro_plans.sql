-- Remove planos legados Axé/Orô e padroniza para Premium/Vita.

-- 1) Normaliza subscriptions existentes para premium.
update public.subscriptions
set
  plan = 'premium'
where lower(coalesce(plan, '')) in ('axe', 'oro', 'free');

-- 2) Remove chaves axe/oro da configuração global de planos.
update public.global_settings
set
  data = coalesce(data, '{}'::jsonb) - 'axe' - 'oro'
where id = 'plans';

-- 3) Garante que existam apenas os planos ativos no JSON global.
update public.global_settings
set
  data = jsonb_strip_nulls(
    coalesce(data, '{}'::jsonb)
    || jsonb_build_object(
      'vita', coalesce(data->'vita', jsonb_build_object(
        'name', 'Plano Vita',
        'price', 49.90,
        'description', 'Plano vitalicio com acesso completo e sem expiracao.'
      )),
      'premium', coalesce(data->'premium', jsonb_build_object(
        'name', 'Premium',
        'price', 149.90,
        'description', 'Gestao espiritual e financeira completa para o seu terreiro.'
      ))
    )
  )
where id = 'plans';
