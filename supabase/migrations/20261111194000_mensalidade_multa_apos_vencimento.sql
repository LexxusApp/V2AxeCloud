begin;

alter table public.financeiro add column mensalidade_multa jsonb;
alter table public.financeiro add constraint financeiro_mensalidade_multa_valida check (
  mensalidade_multa is null or (
    categoria is not distinct from 'Mensalidade'
    and tipo is not distinct from 'entrada'
    and data_vencimento is not null
    and lancamento_manual
    and (jsonb_typeof(mensalidade_multa) = 'object'
      and mensalidade_multa->>'tipo' in ('valor', 'porcentagem')
      and jsonb_typeof(mensalidade_multa->'base') = 'number'
      and jsonb_typeof(mensalidade_multa->'extra') = 'number'
      and jsonb_typeof(mensalidade_multa->'taxa') = 'number'
      and (mensalidade_multa->>'base')::numeric > 0
      and (mensalidade_multa->>'extra')::numeric > 0
      and (mensalidade_multa->>'taxa')::numeric > 0
      and (mensalidade_multa->>'base')::numeric + (mensalidade_multa->>'extra')::numeric <= 999999999
    ) is true
  )
);

create function public.valor_mensalidade_na_data(
  valor numeric, vencimento date, multa jsonb, referencia date
) returns numeric language sql immutable set search_path = public, pg_temp as $$
  select case when multa is null or vencimento is null or referencia is null then valor
    else (multa->>'base')::numeric +
      case when referencia > vencimento then (multa->>'extra')::numeric else 0 end
  end
$$;

create function public.aplicar_multa_mensalidade() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  hoje date := (statement_timestamp() at time zone 'America/Sao_Paulo')::date;
  novo_lancamento boolean;
  vencida boolean;
  base numeric;
  extra numeric;
  complemento text := '';
  marcador constant text := ' (\((?:vencimento|competência) [0-9-]+\)(?: \(ID:[0-9a-f-]{36}\))?)$';
begin
  if new.categoria is distinct from 'Mensalidade' then return new; end if;

  -- The existing insert RPC stores the original payload for idempotency.
  novo_lancamento := coalesce(new.manual_request ? 'mensalidade_multa', false)
    and (tg_op = 'INSERT' or new.manual_request is distinct from old.manual_request);
  if novo_lancamento then
    new.mensalidade_multa := nullif(new.manual_request->'mensalidade_multa', 'null'::jsonb);
  end if;

  if new.mensalidade_multa is null then return new; end if;
  base := (new.mensalidade_multa->>'base')::numeric;
  extra := (new.mensalidade_multa->>'extra')::numeric;

  if new.status in ('pendente', 'pending', 'atrasado', 'overdue') then
    vencida := new.data_vencimento < hoje;
    new.valor := public.valor_mensalidade_na_data(new.valor, new.data_vencimento, new.mensalidade_multa, hoje);
  elsif novo_lancamento and new.status = 'pago' then
    vencida := new.data_vencimento < coalesce(new.data_pagamento, hoje);
    new.valor := public.valor_mensalidade_na_data(
      new.valor, new.data_vencimento, new.mensalidade_multa, coalesce(new.data_pagamento, hoje));
  elsif tg_op = 'UPDATE' and new.status = 'pago' and old.status in ('pendente', 'pending', 'atrasado', 'overdue') then
    -- Preserve the actual amount received. Receipt decisions validate it independently.
    vencida := coalesce(new.data_pagamento, hoje) > new.data_vencimento and new.valor = base + extra;
  else
    return new;
  end if;

  new.descricao := regexp_replace(new.descricao,
    ' \(\+ (?:(?:[0-9.]+)%: )?R\$ [0-9.]+ juros/multa\)(?=' || marcador || ')', '', 'i');
  if vencida then
    complemento := ' (+ ' ||
      case when new.mensalidade_multa->>'tipo' = 'porcentagem'
        then (new.mensalidade_multa->>'taxa') || '%: ' else '' end ||
      'R$ ' || round(extra, 2)::text || ' juros/multa)';
    if new.descricao ~* marcador then
      new.descricao := regexp_replace(new.descricao, marcador, complemento || ' \1', 'i');
    else
      new.descricao := new.descricao || complemento;
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.aplicar_multa_mensalidade() from public, anon, authenticated;
create trigger zz_financeiro_aplicar_multa
before insert or update on public.financeiro
for each row execute function public.aplicar_multa_mensalidade();

-- Recover only open, unexpired manual charges with a recognizable fee and no receipt under review.
with candidatas as (
  select f.id, f.valor,
    regexp_match(f.descricao,
      ' \(\+ (?:(\d+(?:\.\d+)?)%: )?R\$ (\d+(?:\.\d+)?) juros/multa\) \(vencimento [0-9-]+\) \(ID:[0-9a-f-]{36}\)$', 'i') as taxa
  from public.financeiro f
  where f.lancamento_manual and f.categoria = 'Mensalidade' and f.tipo = 'entrada'
    and f.status in ('pendente', 'pending', 'atrasado', 'overdue')
    and f.data_vencimento >= (statement_timestamp() at time zone 'America/Sao_Paulo')::date
    and not exists (select 1 from public.mensalidade_comprovante_envios e
      where e.financeiro_id = f.id and e.status in ('em_analise', 'aceito'))
)
update public.financeiro f
set mensalidade_multa = jsonb_build_object(
  'base', c.valor - c.taxa[2]::numeric,
  'extra', c.taxa[2]::numeric,
  'tipo', case when c.taxa[1] is null then 'valor' else 'porcentagem' end,
  'taxa', coalesce(c.taxa[1], c.taxa[2])::numeric)
from candidatas c
where f.id = c.id and c.taxa[2]::numeric > 0 and c.valor > c.taxa[2]::numeric
  and coalesce(c.taxa[1], c.taxa[2])::numeric > 0 and c.valor <= 999999999;

-- All readers of financeiro.valor, including Pix and reminders, see the same amount.
create index financeiro_multa_a_aplicar_idx on public.financeiro (data_vencimento)
where status in ('pendente', 'pending', 'atrasado', 'overdue')
  and mensalidade_multa is not null and valor = (mensalidade_multa->>'base')::numeric;

create function public.atualizar_multas_mensalidades() returns void
language sql set search_path = public, pg_temp as $$
  update public.financeiro
  set valor = valor
  where status in ('pendente', 'pending', 'atrasado', 'overdue')
    and mensalidade_multa is not null and valor = (mensalidade_multa->>'base')::numeric
    and data_vencimento < (statement_timestamp() at time zone 'America/Sao_Paulo')::date
$$;
revoke all on function public.atualizar_multas_mensalidades() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('axecloud-multas-mensalidades', '0 * * * *', 'select public.atualizar_multas_mensalidades()');

-- Keep the deployed authorization, row locks, and audit writes of these RPCs.
do $$
declare
  definition text;
  expected text;
begin
  definition := pg_get_functiondef('public.decidir_envio_comprovante(uuid,uuid,text,jsonb)'::regprocedure);
  expected := 'v_valor is distinct from f.valor';
  if strpos(definition, expected) = 0 then raise exception 'Revisar validação do valor do comprovante antes de migrar'; end if;
  execute replace(definition, expected,
    'v_valor is distinct from public.valor_mensalidade_na_data(f.valor,f.data_vencimento,f.mensalidade_multa,v_data)');

  definition := pg_get_functiondef('public.piloto_criar_mensalidade_quitada(uuid,uuid,jsonb,date)'::regprocedure);
  expected := '   extra:=round(case when';
  if strpos(definition, expected) = 0 then raise exception 'Revisar cálculo da mensalidade quitada antes de migrar'; end if;
  definition := replace(definition, expected, '   if p_data_pagamento > due then' || chr(10) || expected);
  expected := ' juros/multa)'';';
  if strpos(definition, expected) = 0 then raise exception 'Revisar descrição da mensalidade quitada antes de migrar'; end if;
  execute replace(definition, expected, expected || chr(10) || '   end if;');

  definition := replace(pg_get_functiondef('public.piloto_liquidar_mensalidade(uuid,uuid,date,numeric,uuid)'::regprocedure), chr(13), '');
  expected := 'or f.valor is distinct from p_valor' || chr(10);
  if strpos(definition, expected) = 0 then raise exception 'Revisar baixa manual antes de migrar'; end if;
  definition := replace(definition, expected,
    'or public.valor_mensalidade_na_data(f.valor,f.data_vencimento,f.mensalidade_multa,p_data_pagamento) is distinct from p_valor' || chr(10));
  expected := 'set status=''pago'',tipo=''entrada'',data=p_data_pagamento';
  if strpos(definition, expected) = 0 then raise exception 'Revisar registro da baixa manual antes de migrar'; end if;
  execute replace(definition, expected, 'set status=''pago'',tipo=''entrada'',valor=p_valor,data=p_data_pagamento');

  definition := replace(pg_get_functiondef('public.piloto_reabrir_mensalidade(uuid,uuid,date,numeric,uuid)'::regprocedure), chr(13), '');
  expected := 'or f.valor is distinct from p_valor' || chr(10) || '     or f.data is distinct';
  if strpos(definition, expected) = 0 then raise exception 'Revisar repetição de reabertura antes de migrar'; end if;
  definition := replace(definition, expected, 'or (f.mensalidade_multa is null and f.valor is distinct from p_valor)'
    || chr(10) || '     or f.data is distinct');
  expected := 'set status=''pendente'',data=due,data_pagamento=null where id=f.id;';
  if strpos(definition, expected) = 0 then raise exception 'Revisar registro de reabertura antes de migrar'; end if;
  execute replace(definition, expected, expected || chr(10)
    || ' select valor into f.valor from public.financeiro where id=f.id;' || chr(10)
    || ' result:=result||jsonb_build_object(''valor'',f.valor);');
end
$$;

notify pgrst, 'reload schema';
commit;
