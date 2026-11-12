begin;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  admin_id uuid;
  ticket_id uuid := gen_random_uuid();
  admin_audience uuid := '00000000-0000-0000-0000-000000000000';
  before_change timestamptz;
begin
  select id into strict admin_id from public.perfil_lider where is_admin_global is true limit 1;
  insert into public.support_tickets (id, owner_id, tenant_id, house_name, owner_name, subject, description, category)
  values (ticket_id, owner_id, owner_id, 'Casa QA', 'Pessoa QA', 'Teste suporte', 'Chamado temporário para validar os sinais.', 'gira');
  select changed_at into strict before_change from public.support_activity where audience_id = owner_id;
  insert into public.support_messages (id, ticket_id, author_id, author_role, body)
  values (gen_random_uuid(), ticket_id, admin_id, 'support', 'Resposta QA');
  if not exists(select from public.support_activity where audience_id = owner_id and changed_at > before_change) then
    raise exception 'A resposta precisa gerar atualização para o titular';
  end if;
  select changed_at into strict before_change from public.support_activity where audience_id = admin_audience;
  update public.support_tickets set status = 'closed' where id = ticket_id;
  if not exists(select from public.support_activity where audience_id = admin_audience and changed_at > before_change) then
    raise exception 'A finalização precisa gerar atualização para o console';
  end if;
  if has_table_privilege('anon', 'public.support_activity', 'select')
    or has_table_privilege('authenticated', 'public.support_activity', 'insert')
    or has_table_privilege('authenticated', 'public.support_tickets', 'select') then
    raise exception 'Os sinais e os chamados devem respeitar os privilégios do fluxo';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.support_activity) <> 1
    or not exists(select from public.support_activity where audience_id = owner_id) then
    raise exception 'O titular só pode receber o próprio sinal';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if exists(select from public.support_activity) then
    raise exception 'Uma conta diferente recebeu sinais do chamado';
  end if;
  execute 'reset role';

  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not exists(select from public.support_activity where audience_id = admin_audience) then
    raise exception 'O administrador precisa receber o sinal do console';
  end if;
  execute 'reset role';
end;
$test$;

select 'Sinais de suporte e isolamento entre contas validados' as resultado;
rollback;
