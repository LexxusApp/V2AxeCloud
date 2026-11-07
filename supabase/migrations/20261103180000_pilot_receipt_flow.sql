begin;

-- Service-only bridge for the one member already authorized in the pilot.
-- No client role receives a new grant and all non-pilot receipt flows remain unchanged.
create or replace function public.piloto_registrar_envio_comprovante(
 p_actor uuid,p_tenant uuid,p_filho uuid,p_financeiro uuid,p_request uuid,
 p_path text,p_sha text,p_mime text,p_size integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.role() is distinct from 'service_role'
    or p_tenant is distinct from 'fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid
    or p_actor is distinct from 'ab2eef13-604c-4c8f-9d14-f3da41cc5a81'::uuid
    or p_filho is distinct from '3666b777-1066-4eb7-a0c3-f63c2e01ae90'::uuid
    or not exists(select 1 from public.filhos_de_santo f where f.id=p_filho and f.user_id=p_actor
      and f.tenant_id=p_tenant and f.lider_id=p_tenant
      and lower(btrim(coalesce(f.status::text,''))) in ('ativo','active'))
    or not exists(select 1 from auth.users u where u.id=p_actor
      and lower(u.email) in ('lucasteste@gmail.com','f_3666b777-1066-4eb7-a0c3-f63c2e01ae90@axecloud.internal'))
    or not exists(select 1 from public.perfil_lider where id=p_tenant) then
  raise exception 'Envio restrito às identidades já autorizadas no piloto' using errcode='42501';
 end if;
 return public.registrar_envio_comprovante(p_actor,p_tenant,p_filho,p_financeiro,p_request,p_path,p_sha,p_mime,p_size);
end $$;
revoke all on function public.piloto_registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.piloto_registrar_envio_comprovante(uuid,uuid,uuid,uuid,uuid,text,text,text,integer) to service_role;

-- Preserve the member link, historical competence and fee description when the
-- canonical receipt decision changes a legacy monthly charge to paid.
create or replace function public.piloto_preservar_cobranca_comprovante()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare pilot constant uuid:='fad75b91-d2eb-4805-b5a3-c19e8a073bed';child_id uuid;
begin
 if old.tenant_id is distinct from pilot or new.tenant_id is distinct from pilot
    or old.categoria is distinct from 'Mensalidade' or new.categoria is distinct from 'Mensalidade'
    or new.status is distinct from 'pago'
    or not(coalesce(old.status,'') in ('pendente','pending','atrasado','overdue')
      or (old.status is null and old.descricao ilike '%(vencimento%')) then return new;end if;
 begin
  select e.filho_id into strict child_id
   from public.mensalidade_comprovante_envios e
   join public.financeiro_comprovantes r on r.financeiro_id=e.financeiro_id
    and r.filho_id=e.filho_id and r.arquivo_sha256=e.arquivo_sha256
   join public.filhos_de_santo c on c.id=e.filho_id
   where e.financeiro_id=old.id and e.tenant_id=pilot and r.tenant_id=pilot
    and e.status='aceito' and r.status='aceito' and e.decided_by=pilot
    and e.decided_at=transaction_timestamp() and r.accepted_at=transaction_timestamp()
    and r.valor=new.valor and r.valor=old.valor and r.data_pagamento=new.data_pagamento
    and (c.tenant_id=pilot or c.lider_id=pilot)
    and coalesce(old.filho_id::text,lower(substring(old.descricao from '\(ID:([0-9a-fA-F-]{36})\)')))=e.filho_id::text;
 exception when no_data_found then return new;
 end;
 new.filho_id:=child_id;
 if nullif(btrim(old.descricao),'') is not null then
  new.descricao:=regexp_replace(old.descricao,'\(vencimento [0-9-]+\)',
   '(competência '||coalesce(old.data_vencimento,old.data)::text||')','i');
 end if;
 return new;
end $$;
revoke all on function public.piloto_preservar_cobranca_comprovante() from public,anon,authenticated;
drop trigger if exists piloto_preservar_cobranca_comprovante on public.financeiro;
create trigger piloto_preservar_cobranca_comprovante before update of status on public.financeiro
 for each row execute function public.piloto_preservar_cobranca_comprovante();

notify pgrst,'reload schema';
commit;
