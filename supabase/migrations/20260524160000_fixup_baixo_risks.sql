-- B4: remove perfil_lider fantasma ("Meu Terreiro") de contas filho.
-- B5: normaliza tenant_id stale em filhos_de_santo para coincidir com lider_id.
-- B7: fix search_path mutável em funções legadas (lint 0011).

-- B4
delete from public.perfil_lider pl
where pl.nome_terreiro = 'Meu Terreiro'
  and exists (
    select 1
    from public.filhos_de_santo f
    where f.user_id = pl.id
  );

-- B5
update public.filhos_de_santo f
set tenant_id = f.lider_id
where f.lider_id is not null
  and f.tenant_id is distinct from f.lider_id;

-- B7 — aplica search_path fixo a todas as overloads listadas pelo advisor
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as func
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_my_tenant_id',
        'is_super_admin',
        '_subscriptions_set_updated_at',
        '_audit_targets_set_updated_at',
        'processar_checkout',
        'is_admin_global',
        'prevent_admin_escalation',
        'get_tenant_id',
        'handle_new_user',
        'is_admin'
      )
  loop
    execute format('alter function %s set search_path = public', r.func);
  end loop;
end $$;
