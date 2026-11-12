begin;

create table public.support_tickets (
  id uuid primary key,
  owner_id uuid not null,
  tenant_id uuid not null,
  house_name text not null,
  owner_name text not null,
  subject text not null check (length(btrim(subject)) between 3 and 120),
  description text not null check (length(btrim(description)) between 5 and 4000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_owner_recent on public.support_tickets (owner_id, updated_at desc, id desc);
create index support_tickets_recent on public.support_tickets (updated_at desc, id desc);

create table public.support_messages (
  id uuid primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null,
  author_role text not null check (author_role in ('owner', 'support')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index support_messages_thread on public.support_messages (ticket_id, created_at, id);
create index support_messages_replies on public.support_messages (ticket_id, created_at desc) where author_role = 'support';

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from public, anon, authenticated;
grant all on public.support_tickets, public.support_messages to service_role;

-- Preserve the in-app history that was saved by the pilot.
insert into public.support_tickets (id, owner_id, tenant_id, house_name, owner_name, subject, description, status, created_at, updated_at)
select ticket.id, profile.id, ticket.tenant_id,
  coalesce(nullif(ticket.dados->>'house', ''), profile.nome_terreiro, 'Terreiro'),
  coalesce(nullif(ticket.dados->>'responsible', ''), profile.zelador, 'Zeladoria'),
  ticket.dados->>'subject', ticket.dados->>'text', ticket.status, ticket.created_at, ticket.updated_at
from public.piloto_suporte_chamados ticket
join public.perfil_lider profile on profile.id = ticket.tenant_id
where length(btrim(ticket.dados->>'subject')) between 3 and 120
  and length(btrim(ticket.dados->>'text')) between 5 and 4000;

insert into public.support_messages (id, ticket_id, author_id, author_role, body, created_at)
select message.id, ticket.id, ticket.owner_id, 'owner', message.texto, message.created_at
from public.piloto_suporte_complementos message
join public.support_tickets ticket on ticket.id = message.chamado_id and ticket.tenant_id = message.tenant_id;

create function public.touch_support_ticket()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  update public.support_tickets
  set updated_at = greatest(updated_at, new.created_at), status = 'open'
  where id = new.ticket_id;
  return new;
end;
$$;

create trigger support_messages_touch_ticket
after insert on public.support_messages for each row execute function public.touch_support_ticket();

alter table public.evento_participantes add column resposta_membro boolean not null default false;

create function public.notificar_resposta_membro_gira()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  event_title text;
  member_name text;
  is_request boolean := new.status = 'pendente' and new.justificativa is not distinct from 'Aguardando aprovação';
begin
  if not new.resposta_membro or new.responded_at is null or (new.status <> 'confirmado' and not is_request) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.status = old.status and new.justificativa is not distinct from old.justificativa then
      return new;
    end if;
  end if;

  select e.titulo, f.nome into event_title, member_name
  from public.calendario_axe e
  join public.filhos_de_santo f on f.id = new.filho_id
  where e.id = new.event_id
    and new.tenant_id in (e.tenant_id, e.lider_id)
    and (new.tenant_id in (f.tenant_id, f.lider_id)
      or e.lider_id in (f.tenant_id, f.lider_id)
      or e.tenant_id in (f.tenant_id, f.lider_id));
  if not found then return new; end if;
  insert into public.notificacoes (tenant_id, tipo, mensagem, lida)
  values (new.tenant_id,
    case when is_request then 'gira_presenca_solicitada' else 'gira_presenca_confirmada' end,
    coalesce(nullif(member_name, ''), 'Um membro') ||
      case when is_request then ' solicitou presença em ' else ' confirmou presença em ' end ||
      coalesce(nullif(event_title, ''), 'uma gira') || '.', false);
  return new;
end;
$$;

revoke all on function public.notificar_resposta_membro_gira() from public, anon, authenticated;
create trigger evento_participantes_resposta_membro
after insert or update of resposta_membro on public.evento_participantes
for each row execute function public.notificar_resposta_membro_gira();

alter table public.mensalidade_comprovante_envios
  drop constraint mensalidade_comprovante_envios_analysis_status_check,
  add constraint mensalidade_comprovante_envios_analysis_status_check
    check (analysis_status in ('manual', 'pendente', 'concluida', 'indisponivel')),
  alter column analysis_status set default 'manual';

-- The currently deployed decision also enforces tenant access, payment
-- evidence, and late fees. Update only the justification for historical OCR.
do $$
declare
  definition text := pg_get_functiondef('public.decidir_envio_comprovante(uuid,uuid,text,jsonb)'::regprocedure);
  expected text := 'e.analysis_status<>''concluida''';
begin
  if strpos(definition, expected) = 0 then
    raise exception 'Revisar regra de justificativa antes de migrar';
  end if;
  execute replace(definition, expected, 'e.analysis_status in (''pendente'', ''indisponivel'')');
end;
$$;

notify pgrst, 'reload schema';
commit;
