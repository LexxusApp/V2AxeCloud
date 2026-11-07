begin;
create or replace function public.piloto_ler_preferencias_whatsapp(p_metadata jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select jsonb_build_object('days',case when p_metadata->'preferences'->>'giraReminderIntervalDays'~'^[1-7]$' then (p_metadata->'preferences'->>'giraReminderIntervalDays')::int else 3 end,
 'sameDay',coalesce((p_metadata->'preferences'->>'notifGiraNoDia')::boolean,false),'obligations',coalesce((p_metadata->'preferences'->>'notifObrigacoes')::boolean,false),
 'monthly',coalesce((p_metadata->'preferences'->>'notifFinanceiro')::boolean,true),'cantina',coalesce((p_metadata->'preferences'->>'notifCantina')::boolean,false));
$$;
revoke all on function public.piloto_ler_preferencias_whatsapp(jsonb) from public,anon,authenticated;

create or replace function public.piloto_agendar_lembrete_gira(p_tenant uuid,p_event uuid,p_ativo boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;prefs jsonb;days int;on_day boolean;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_ativo is null then raise exception 'Informe se o lembrete está ativo' using errcode='22023';end if;
 perform 1 from public.calendario_axe where id=p_event and tenant_id=p_tenant and tipo<>'Obrigação' for update;
 if not found then raise exception 'Gira não pertence a esta casa' using errcode='42501';end if;
 if p_ativo and exists(select 1 from public.piloto_gira_preparacao where event_id=p_event and encerrada) then raise exception 'Gira encerrada não recebe novos lembretes' using errcode='22023';end if;
 if not p_ativo then update public.calendario_axe set wa_reminder_interval_days=null where id=p_event;return jsonb_build_object('event_id',p_event,'active',false);end if;
 select public.piloto_ler_preferencias_whatsapp(metadata) into prefs from public.whatsapp_config where tenant_id=p_tenant;
 prefs:=coalesce(prefs,public.piloto_ler_preferencias_whatsapp('{}'));days:=(prefs->>'days')::int;on_day:=(prefs->>'sameDay')::boolean;
 update public.calendario_axe set wa_reminder_interval_days=days,wa_reminder_mode=case when on_day then 'quantidade' else 'antes' end,
 wa_reminder_count=case when on_day then 2 else null end,wa_reminder_window_kind='relativa',wa_reminder_window_start_days=days,wa_reminder_window_end_days=case when on_day then 0 else days end,
 wa_reminder_window_start_date=null,wa_reminder_window_end_date=null where id=p_event;
 return jsonb_build_object('event_id',p_event,'active',true,'days',days,'sameDay',on_day);
end $$;

create or replace function public.piloto_configurar_whatsapp(p_tenant uuid,p_dados jsonb,p_antes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;meta jsonb;current_state jsonb;pref jsonb;days int;on_day boolean;scheduled int:=0;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if jsonb_typeof(p_dados) is distinct from 'object' or coalesce(p_dados->>'days','')!~'^[1-7]$'
 or jsonb_typeof(p_dados->'sameDay') is distinct from 'boolean' or jsonb_typeof(p_dados->'obligations') is distinct from 'boolean'
 or jsonb_typeof(p_dados->'monthly') is distinct from 'boolean' or jsonb_typeof(p_dados->'cantina') is distinct from 'boolean' then raise exception 'Confira as preferências dos avisos' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':pilot-whatsapp-config',0));
 select metadata into meta from public.whatsapp_config where tenant_id=p_tenant for update;meta:=coalesce(meta,'{}'::jsonb);
 current_state:=public.piloto_ler_preferencias_whatsapp(meta);
 if current_state=p_dados then return jsonb_build_object('tenant_id',p_tenant,'preferences',current_state,'scheduled',0,'replayed',true);end if;
 if current_state is distinct from p_antes then raise exception 'As preferências mudaram em outro aparelho. Atualize antes de salvar.' using errcode='23505';end if;
 pref:=jsonb_build_object('giraReminderIntervalDays',(p_dados->>'days')::int,'notifGiraNoDia',(p_dados->>'sameDay')::boolean,'notifObrigacoes',(p_dados->>'obligations')::boolean,'notifFinanceiro',(p_dados->>'monthly')::boolean,'notifCantina',(p_dados->>'cantina')::boolean);
 meta:=meta||jsonb_build_object('channel','official','preferences',jsonb_build_object('notifGiras',true,'notifFinanceiro',true,'notifReza',true,'notifAniversarios',true)||coalesce(meta->'preferences','{}'::jsonb)||pref);
 insert into public.whatsapp_config(id,tenant_id,metadata,status) values(p_tenant,p_tenant,meta,'CONNECTED') on conflict(tenant_id) do update set metadata=excluded.metadata,updated_at=now();
 if current_state->'days' is distinct from p_dados->'days' or current_state->'sameDay' is distinct from p_dados->'sameDay' then
  days:=(p_dados->>'days')::int;on_day:=(p_dados->>'sameDay')::boolean;
  update public.calendario_axe e set wa_reminder_interval_days=days,wa_reminder_mode=case when on_day then 'quantidade' else 'antes' end,
   wa_reminder_count=case when on_day then 2 else null end,wa_reminder_window_kind='relativa',wa_reminder_window_start_days=days,wa_reminder_window_end_days=case when on_day then 0 else days end,
   wa_reminder_window_start_date=null,wa_reminder_window_end_date=null
  where e.tenant_id=p_tenant and e.tipo<>'Obrigação' and e.status_confirmacao<>'Cancelado' and e.data>=(now() at time zone 'America/Sao_Paulo')::date
   and e.wa_reminder_interval_days is not null and not exists(select 1 from public.piloto_gira_preparacao g where g.event_id=e.id and g.encerrada);
  get diagnostics scheduled=row_count;
 end if;
 return jsonb_build_object('tenant_id',p_tenant,'preferences',p_dados,'scheduled',scheduled,'replayed',false);
end $$;

create table if not exists public.piloto_avisos_cantina(
 financeiro_id uuid primary key references public.financeiro(id) on delete cascade,tenant_id uuid not null,request_id uuid not null unique,
 estado text not null check(estado in ('solicitando','solicitado','incerto')),external_id text,error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.piloto_avisos_cantina enable row level security;
revoke all on public.piloto_avisos_cantina from public,anon,authenticated;
grant select on public.piloto_avisos_cantina to authenticated;
create policy pilot_owner_read on public.piloto_avisos_cantina for select to authenticated using(tenant_id=auth.uid() and auth.uid()='fad75b91-d2eb-4805-b5a3-c19e8a073bed'::uuid);
create or replace function public.piloto_iniciar_aviso_cantina(p_tenant uuid,p_financeiro uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;f public.financeiro;job public.piloto_avisos_cantina;pref jsonb;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 if p_request is null then raise exception 'Identificação do aviso obrigatória' using errcode='22023';end if;
 select * into f from public.financeiro where id=p_financeiro and tenant_id=p_tenant for update;
 if not found or f.categoria<>'Cantina' or f.status<>'pendente' or f.filho_id is null then raise exception 'Consumo não está pendente na caderneta desta casa' using errcode='22023';end if;
 select public.piloto_ler_preferencias_whatsapp(metadata) into pref from public.whatsapp_config where tenant_id=p_tenant;
 if coalesce((pref->>'cantina')::boolean,false) is not true then return jsonb_build_object('send',false,'reason','disabled');end if;
 select * into job from public.piloto_avisos_cantina where financeiro_id=p_financeiro;
 if found then return jsonb_build_object('send',false,'reason',job.estado);end if;
 insert into public.piloto_avisos_cantina(financeiro_id,tenant_id,request_id,estado) values(p_financeiro,p_tenant,p_request,'solicitando');
 return jsonb_build_object('send',true,'member_id',f.filho_id,'amount',f.valor,'request_id',p_request);
end $$;
create or replace function public.piloto_finalizar_aviso_cantina(p_tenant uuid,p_financeiro uuid,p_request uuid,p_external text,p_error text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid;job public.piloto_avisos_cantina;
begin
 actor:=public.piloto_validar_zelador(p_tenant);
 select * into job from public.piloto_avisos_cantina where financeiro_id=p_financeiro and tenant_id=p_tenant and request_id=p_request for update;
 if not found then raise exception 'Aviso não pertence a esta solicitação' using errcode='42501';end if;
 if length(coalesce(p_external,''))>300 or length(coalesce(p_error,''))>1000 then raise exception 'Resposta de envio inválida' using errcode='22023';end if;
 update public.piloto_avisos_cantina set estado=case when nullif(p_external,'') is not null and nullif(p_error,'') is null then 'solicitado' else 'incerto' end,external_id=nullif(p_external,''),error=nullif(p_error,''),updated_at=now() where financeiro_id=p_financeiro returning * into job;
 return jsonb_build_object('financeiro_id',job.financeiro_id,'state',job.estado);
end $$;
revoke all on function public.piloto_configurar_whatsapp(uuid,jsonb,jsonb),public.piloto_agendar_lembrete_gira(uuid,uuid,boolean),public.piloto_iniciar_aviso_cantina(uuid,uuid,uuid),public.piloto_finalizar_aviso_cantina(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.piloto_configurar_whatsapp(uuid,jsonb,jsonb),public.piloto_agendar_lembrete_gira(uuid,uuid,boolean),public.piloto_iniciar_aviso_cantina(uuid,uuid,uuid),public.piloto_finalizar_aviso_cantina(uuid,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
