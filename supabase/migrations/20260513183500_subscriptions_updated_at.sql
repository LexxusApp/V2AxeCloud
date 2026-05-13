-- Adiciona coluna updated_at em public.subscriptions (opcional, para auditoria).
-- A aplicacao funciona sem essa coluna; ela so passa a ser util se algum trigger
-- ou consulta precisar acompanhar a ultima atualizacao do registro.

alter table public.subscriptions
  add column if not exists updated_at timestamptz default now();

-- Trigger para atualizar updated_at automaticamente em qualquer UPDATE.
create or replace function public._subscriptions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public._subscriptions_set_updated_at();
