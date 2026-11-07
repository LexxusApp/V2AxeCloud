begin;
create or replace function public.piloto_liquidar_cantina(p_tenant uuid,p_filho uuid,p_request uuid,p_transacoes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;ids uuid[];pending uuid[];payload jsonb;prior public.piloto_financeiro_acoes;entry jsonb;f public.financeiro;result jsonb;total numeric:=0;affected integer:=0;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_filho is null or p_request is null or jsonb_typeof(p_transacoes) is distinct from 'array' then raise exception 'Confira o membro e as comandas do acerto' using errcode='22023';end if;
 if jsonb_array_length(p_transacoes) not between 1 and 1000 then raise exception 'Confira as comandas do acerto' using errcode='22023';end if;
 for entry in select * from jsonb_array_elements(p_transacoes) loop
  if jsonb_typeof(entry) is distinct from 'object' or coalesce(entry->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(entry->'valor') is distinct from 'number' then raise exception 'Comanda inválida' using errcode='22023';end if;
  if (entry->>'valor')::numeric<=0 or (entry->>'valor')::numeric>999999999 or (entry->>'valor')::numeric*100<>trunc((entry->>'valor')::numeric*100) then raise exception 'Valor da comanda inválido' using errcode='22023';end if;
 end loop;
 select array_agg((value->>'id')::uuid order by (value->>'id')::uuid),jsonb_agg(jsonb_build_object('id',(value->>'id')::uuid,'valor',(value->>'valor')::numeric) order by (value->>'id')::uuid) into ids,payload from jsonb_array_elements(p_transacoes);
 if cardinality(ids)<>(select count(distinct unnest_id) from unnest(ids) unnest_id) then raise exception 'Há uma comanda repetida no acerto' using errcode='22023';end if;
 payload:=jsonb_build_object('operation','cantina-settlement','member',p_filho,'transactions',payload);
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-finance',0));
 perform 1 from public.filhos_de_santo where id=p_filho and (tenant_id=p_tenant or lider_id=actor) for update;
 if not found then raise exception 'Membro não pertence a esta casa' using errcode='42501';end if;
 -- Lock only Cantina rows; a Loja order is never included in this confirmation.
 perform id from public.financeiro where filho_id=p_filho and (tenant_id=p_tenant or lider_id=actor) and categoria='Cantina' order by id for update;
 select * into prior from public.piloto_financeiro_acoes where request_id=p_request;
 if found then
  if prior.actor<>actor or prior.tenant_id<>p_tenant or prior.payload is distinct from payload then raise exception 'Esta identificação já foi usada em outro acerto' using errcode='23505';end if;
  if exists(select 1 from jsonb_array_elements(p_transacoes) expected left join public.financeiro actual on actual.id=(expected->>'id')::uuid where actual.id is null or actual.status<>'pago' or actual.valor is distinct from (expected->>'valor')::numeric or actual.filho_id is distinct from p_filho or actual.categoria is distinct from 'Cantina' or not(coalesce(actual.tenant_id=p_tenant,false) or coalesce(actual.lider_id=actor,false))) then raise exception 'O acerto mudou; atualize a caderneta' using errcode='23505';end if;
  return prior.result||jsonb_build_object('replayed',true);
 end if;
 select array_agg(id order by id) into pending from public.financeiro where filho_id=p_filho and (tenant_id=p_tenant or lider_id=actor) and categoria='Cantina' and status='pendente';
 if pending is distinct from ids then raise exception 'A caderneta mudou. Atualize e confira o total antes de receber.' using errcode='23505';end if;
 for entry in select * from jsonb_array_elements(p_transacoes) loop
  select * into f from public.financeiro where id=(entry->>'id')::uuid;
  if f.filho_id is distinct from p_filho or f.categoria is distinct from 'Cantina' or f.valor is distinct from (entry->>'valor')::numeric or not(coalesce(f.tenant_id=p_tenant,false) or coalesce(f.lider_id=actor,false)) then raise exception 'O valor ou vínculo da comanda mudou' using errcode='23505';end if;
  if exists(select 1 from public.pedidos where financeiro_id=f.id) then raise exception 'Esta comanda está vinculada a um pedido. Confira pela Loja.' using errcode='23505';end if;
  if public.pagamento_caderneta(p_tenant,actor,p_filho,f.id,'liquidar')<>1 then raise exception 'O recebimento não foi confirmado' using errcode='23505';end if;
  total:=total+f.valor;affected:=affected+1;
 end loop;
 result:=jsonb_build_object('memberId',p_filho,'ids',to_jsonb(ids),'count',affected,'totalCents',total*100,'status','pago','replayed',false);
 insert into public.piloto_financeiro_acoes(request_id,actor,tenant_id,financeiro_id,payload,result) values(p_request,actor,p_tenant,ids[1],payload,result);
 return result;
end $$;
revoke all on function public.piloto_liquidar_cantina(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.piloto_liquidar_cantina(uuid,uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
