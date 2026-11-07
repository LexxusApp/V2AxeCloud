begin;
do $test$
declare owner_id uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';e uuid:=gen_random_uuid();t uuid:=gen_random_uuid();r jsonb;
begin
 insert into public.calendario_axe(id,tenant_id,lider_id,titulo,data,hora,tipo,status_confirmacao) values(e,owner_id,owner_id,'VALIDACAO-CODEX-ROLLBACK','2099-01-01','20:00','Gira','Confirmado');
 insert into public.evento_senhas(id,tenant_id,event_id,numero,nome,status) values(t,owner_id,e,1,'Consulente técnico','aguardando');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);execute 'set local role authenticated';
 begin perform public.piloto_atualizar_senha(owner_id,e,t,'atendido','aguardando');raise exception 'Atendeu sem chamar';exception when invalid_parameter_value then null;end;
 r:=public.piloto_atualizar_senha(owner_id,e,t,'chamado','aguardando');if r->>'status'<>'chamado' then raise exception 'Chamada não confirmada';end if;
 r:=public.piloto_atualizar_senha(owner_id,e,t,'chamado','aguardando');if r->>'replayed'<>'true' then raise exception 'Repetição da chamada não é segura';end if;
 r:=public.piloto_atualizar_senha(owner_id,e,t,'atendido','chamado');if r->>'status'<>'atendido' then raise exception 'Atendimento não confirmado';end if;
 if not exists(select 1 from public.evento_senhas where id=t and called_at is not null and attended_at is not null and status='atendido') then raise exception 'Não persistiu atendimento completo';end if;
 begin perform public.piloto_atualizar_senha(owner_id,e,t,'chamado','aguardando');raise exception 'Fila antiga reabriu atendimento encerrado';exception when unique_violation then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub','ab2eef13-604c-4c8f-9d14-f3da41cc5a81','role','authenticated')::text,true);
 begin perform public.piloto_atualizar_senha(owner_id,e,t,'chamado','aguardando');raise exception 'Membro alterou fila';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $test$;
rollback;
select 'passed' as ticket_state_validation,'all fixtures rolled back' as persistence;
