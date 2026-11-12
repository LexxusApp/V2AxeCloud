begin;

do $test$
declare
  ticket uuid := gen_random_uuid();
  reply uuid := gen_random_uuid();
  event uuid := gen_random_uuid();
  member uuid := gen_random_uuid();
  owner uuid;
  member_user uuid;
  debt uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  receipt jsonb;
  decision jsonb;
  label text := 'QA - ' || gen_random_uuid()::text;
  sha text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
begin
  select f.user_id, p.id into strict member_user, owner
  from public.filhos_de_santo f
  join public.perfil_lider p on p.id = f.lider_id
  where f.user_id is not null and p.deleted_at is null
  limit 1;

  insert into public.support_tickets(id, owner_id, tenant_id, house_name, owner_name, subject, description, updated_at)
  values(ticket, owner, owner, 'Casa QA', 'Zelador QA', label, 'Chamado temporário de teste.', now() - interval '1 day');
  insert into public.support_messages(id, ticket_id, author_id, author_role, body)
  values(reply, ticket, owner, 'support', 'Resposta temporária de teste.') on conflict do nothing;
  insert into public.support_messages(id, ticket_id, author_id, author_role, body)
  values(reply, ticket, owner, 'support', 'Resposta temporária de teste.') on conflict do nothing;

  if not exists(select from public.support_tickets where id = ticket and updated_at >= now() and waiting_on = 'owner' and protocol > 0)
    or (select count(*) from public.support_messages where ticket_id = ticket and author_role = 'support') <> 1 then
    raise exception 'A resposta deve ficar no chamado e produzir um único aviso';
  end if;
  update public.support_tickets set status = 'closed' where id = ticket;
  begin
    insert into public.support_messages(id, ticket_id, author_id, author_role, body)
    values(gen_random_uuid(), ticket, owner, 'owner', 'Mensagem após finalização.');
    raise exception 'Chamado finalizado aceitou mensagem' using errcode = '22023';
  exception when raise_exception then null;
  end;
  update public.support_tickets set status = 'open', waiting_on = 'support' where id = ticket;
  insert into public.support_messages(id, ticket_id, author_id, author_role, body)
  values(gen_random_uuid(), ticket, owner, 'owner', 'Mensagem após reabertura.');
  if not exists(select from public.support_tickets where id = ticket and status = 'open' and waiting_on = 'support') then
    raise exception 'A nova mensagem do zelador precisa aguardar o suporte';
  end if;
  if has_table_privilege('authenticated', 'public.support_messages', 'select')
    or has_table_privilege('anon', 'public.support_tickets', 'select') then
    raise exception 'O histórico de suporte deve ficar restrito à API autenticada';
  end if;

  insert into public.filhos_de_santo(id, tenant_id, lider_id, user_id, nome, status)
  values(member, owner, owner, member_user, label, 'Ativo');
  insert into public.calendario_axe(id, tenant_id, lider_id, titulo, tipo, data, hora)
  values(event, owner, owner, label, 'Gira', current_date + 2, '19:00');
  insert into public.evento_participantes(event_id, tenant_id, filho_id, status)
  values(event, owner, member, 'pendente');
  update public.evento_participantes set justificativa = 'Aguardando aprovação', resposta_membro = true, responded_at = now()
  where event_id = event;
  update public.evento_participantes set status = 'confirmado', justificativa = null, resposta_membro = false
  where event_id = event;
  update public.evento_participantes set status = 'recusado', resposta_membro = true
  where event_id = event;
  update public.evento_participantes set status = 'confirmado', resposta_membro = true
  where event_id = event;
  update public.evento_participantes set status = 'confirmado', resposta_membro = true, responded_at = clock_timestamp()
  where event_id = event;
  if (select count(*) from public.notificacoes where tenant_id = owner and tipo = 'gira_presenca_solicitada' and mensagem like '%' || label || '%') <> 1
    or (select count(*) from public.notificacoes where tenant_id = owner and tipo = 'gira_presenca_confirmada' and mensagem like '%' || label || '%') <> 1 then
    raise exception 'Pedido e confirmação de gira precisam de um aviso cada';
  end if;

  insert into public.financeiro(id, tenant_id, lider_id, filho_id, tipo, categoria, status, valor, data, data_vencimento, descricao)
  values(debt, owner, owner, member, 'entrada', 'Mensalidade', 'pendente', 102, current_date, current_date, label);
  execute 'set local role service_role';
  receipt := public.registrar_envio_comprovante(member_user, owner, member, debt, request_id,
    owner || '/' || member || '/' || request_id || '.png', sha, 'image/png', 128);
  if receipt->>'analysis_status' <> 'manual' or receipt->'analysis' <> '{}'::jsonb
    or not exists(select from public.financeiro where id = debt and status = 'pendente')
    or not exists(select from public.mensalidade_comprovante_eventos
      where envio_id = (receipt->>'id')::uuid and tenant_id = owner and tipo = 'enviado') then
    raise exception 'O anexo manual deve avisar a zeladoria sem dar baixa';
  end if;
  decision := public.decidir_envio_comprovante(owner, (receipt->>'id')::uuid, 'aceito',
    jsonb_build_object('valor', 102, 'data_pagamento', (now() at time zone 'America/Sao_Paulo')::date,
      'beneficiario', 'Casa QA', 'id_transacao', 'EQA' || replace(ticket::text, '-', ''), 'confirmo_recebimento', true));
  if decision->>'status' <> 'aceito' or not exists(select from public.financeiro where id = debt and status = 'pago') then
    raise exception 'A análise manual deve permitir a baixa confirmada';
  end if;
  execute 'reset role';
end;
$test$;

select 'Suporte, gira e comprovante validados em transação revertida' as resultado;
rollback;
